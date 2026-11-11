const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync(require.resolve("../extension/privacy.js"), "utf8") + fs.readFileSync(require.resolve("../extension/processing.js"), "utf8");
const post = { raw_text: "Group: Thuê trọ\n\nCăn A 3 triệu, căn B 5 triệu", rental_status: "yes", listing_count: "multiple" };

function setup(result, { status = 200, reason = "stop" } = {}) {
  let sent;
  const context = { fetch: async (url, options) => {
    sent = { url, options, body: JSON.parse(options.body) };
    return { ok: status === 200, status, json: async () => ({ choices: [{ finish_reason: reason, message: { content: JSON.stringify(result) } }] }) };
  } };
  vm.runInNewContext(source, context);
  return { processing: context.TroProcessing, sent: () => sent };
}

const listing = { property_type: "phòng", address: null, ward: null, district: "Quận 1", city: null,
  rent_price: "3 triệu/tháng", area: null, contact: null, additional_info: null };

test("extraction uses the correct prompt, validates all units and keeps original units", async () => {
  const { processing, sent } = setup({ listings: [listing, { ...listing, rent_price: "5 triệu/tháng" }] });
  const result = await processing.extract({ post, apiKey: "secret", model: "model" });
  assert.equal(result.listings.length, 2);
  assert.equal(result.listings[1].rent_price, "5 triệu/tháng");
  assert.match(sent().body.messages[0].content, /nhiều căn riêng biệt/);
  const single = setup({ listings: [listing] });
  await single.processing.extract({ post: { ...post, listing_count: "single" }, apiKey: "secret", model: "model" });
  assert.match(single.sent().body.messages[0].content, /dự đoán có một căn/);
});

test("unknown listing count and malformed or empty listings never succeed", async () => {
  const args = { post, apiKey: "secret", model: "model" };
  await assert.rejects(setup({}).processing.extract({ ...args, post: { ...post, listing_count: "uncertain" } }), /unknown/);
  await assert.rejects(setup({ listings: [] }).processing.extract(args), /no listings/);
  await assert.rejects(setup({ listings: [{ ...listing, rent_price: 3000000 }] }).processing.extract(args), /invalid listing field/);
  await assert.rejects(setup({ listings: [Object.fromEntries(Object.keys(listing).map(k => [k, null]))] }).processing.extract(args), /empty listing/);
});

test("HTTP and truncated response errors do not disclose the API key", async () => {
  const args = { post, apiKey: "secret-value", model: "model" };
  await assert.rejects(setup({}, { status: 401 }).processing.extract(args), error => error.message.includes("401") && !error.message.includes("secret-value"));
  await assert.rejects(setup({}, { reason: "length" }).processing.extract(args), /truncated/);
});

test("Ollama extraction uses its endpoint and custom instructions without structured output mode", async () => {
  const { processing, sent } = setup({ listings: [listing] });
  await processing.extract({ post, apiKey: "ollama-secret", model: "example:cloud", provider: "ollama",
    prompt: "Extract Vietnamese rentals carefully.", multiplePrompt: "Split distinct units." });
  assert.equal(sent().url, "https://ollama.com/v1/chat/completions");
  assert.equal(sent().options.headers.Authorization, "Bearer ollama-secret");
  assert.equal(sent().body.response_format, undefined);
  assert.match(sent().body.messages[0].content, /Extract Vietnamese rentals carefully/);
  assert.match(sent().body.messages[0].content, /Split distinct units/);
  assert.match(sent().body.messages[0].content, /mảng không rỗng/);
});

test("Jev sends three questions and maps independent answers into the existing classification", async () => {
  let sent;
  const context = { fetch: async (url, options) => {
    sent = { url, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ model: "typesafe/jev-snapshot", answers: {
      listing: { type: "noul", noul: 0.9 }, price: { type: "noul", noul: 0.2 },
      count: { type: "choice", choice: "unknown", probabilities: { single: 0.1, multiple: 0.1, unknown: 0.8 }, confidence: 0.7 },
    } }) };
  } };
  vm.runInNewContext(source, context);
  const result = await context.TroProcessing.classifyJev({ post, apiKey: "key", model: "jev-latest", jevPrice: "Custom price question" });
  assert.equal(sent.url, "https://api.typesafe.ai/v1/systemone");
  assert.equal(sent.body.state.post, post.raw_text);
  assert.equal(sent.body.questions.price.instructions, "Custom price question");
  assert.equal(Object.keys(sent.body.questions).length, 3);
  assert.equal(result.rental_status, "yes");
  assert.equal(result.listing_count, "uncertain");
  assert.equal(result.rent_price_status, "no");
  assert.equal(result.jev_raw_response.answers.listing.noul, 0.9);
  assert.equal(result.jev_raw_response.model, "typesafe/jev-snapshot");
});

test("Jev rejects malformed answers without producing a classification", async () => {
  const context = { fetch: async () => ({ ok: true, json: async () => ({ answers: {
    listing: { type: "noul", noul: 0.9 }, price: { type: "noul", noul: 2 }, count: { type: "choice", choice: "single" },
  } }) }) };
  vm.runInNewContext(source, context);
  await assert.rejects(context.TroProcessing.classifyJev({ post, apiKey: "key", model: "jev" }), /invalid confidence/);
});

test("Jev accepts the most likely count below 0.7", async () => {
  const context = { fetch: async () => ({ ok: true, json: async () => ({ model: "jev", answers: {
    listing: { type: "noul", noul: 0.96 }, price: { type: "noul", noul: 0.98 },
    count: { type: "choice", choice: "single", confidence: 0.53,
      probabilities: { single: 0.69, multiple: 0.04, unknown: 0.27 } },
  } }) }) };
  vm.runInNewContext(source, context);
  const result = await context.TroProcessing.classifyJev({ post, apiKey: "key", model: "jev" });
  assert.equal(result.listing_count, "single");
  assert.equal(result.jev_raw_response.answers.count.probabilities.single, 0.69);
});

test("Jev Noul boundaries include 0.4 and 0.6 in uncertain", async () => {
  for (const [value, expected] of [[0.39, "no"], [0.4, "uncertain"], [0.6, "uncertain"], [0.61, "yes"]]) {
    const context = { fetch: async () => ({ ok: true, json: async () => ({ answers: {
      listing: { type: "noul", noul: value }, price: { type: "noul", noul: value },
      count: { type: "choice", choice: "single", confidence: 1, probabilities: { single: 1, multiple: 0, unknown: 0 } },
    } }) }) };
    vm.runInNewContext(source, context);
    const result = await context.TroProcessing.classifyJev({ post, apiKey: "key", model: "jev" });
    assert.equal(result.rental_status, expected);
    assert.equal(result.rent_price_status, expected === "no" ? "not_applicable" : expected);
  }
});
