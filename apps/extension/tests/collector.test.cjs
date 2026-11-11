const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
// Real Facebook DOM samples are not in git; these tests run only where a team member keeps them.
const hasRealSamples = fs.existsSync(path.join(__dirname, 'fixtures/facebook-feed.html'));
const { collectPosts, extractPost, observePosts } = require('../extension/collector.js');

const BASE_URL = 'https://www.facebook.com/groups/42/';

function createDOM(t, html = '<div role="feed"></div>') {
  const dom = new JSDOM(html, { url: BASE_URL });
  t.after(() => dom.window.close());
  return dom.window.document;
}

function imageHTML(id, suffix = 'a') {
  return `<a href="/photo/?fbid=${id}01&set=pcb.${id}"><img src="https://scontent.example.fbcdn.net/${id}-${suffix}.jpg?token=keep"></a>`;
}

function postHTML(id, options = {}) {
  const {
    text = `Studio ${id}.`,
    images = true,
    directLink = true,
    marker = 'data-ad-rendering-role="story_message"',
    comments = '',
  } = options;
  return `<div data-virtualized="false" class="random-wrapper">
    <div><span data-ad-rendering-role="profile_name"><a href="/profile.php?id=10">Author</a></span>
      ${directLink ? `<a href="/groups/42/posts/${id}/?__cft__=tracking#fragment">2h</a>` : ''}
    </div>
    <div class="random-content">
      <div ${marker}>${text}</div>
      ${images ? imageHTML(id) : ''}
    </div>
    ${comments}
  </div>`;
}

function appendPost(document, id, options) {
  const holder = document.createElement('div');
  holder.innerHTML = postHTML(id, options);
  const post = holder.firstElementChild;
  document.querySelector('[role="feed"]').append(post);
  return post;
}

function startObserver(t, document, options = {}) {
  const batches = [];
  const observer = observePosts({
    document,
    debounceMs: 0,
    expansionTimeoutMs: 25,
    expand: false,
    onPosts: (posts) => batches.push(posts),
    ...options,
  });
  t.after(() => observer.stop());
  return { observer, batches, records: () => batches.flat() };
}

function selectedFields(record) {
  const { postId, postUrl, text, images, textStatus } = record;
  return { postId, postUrl, text, images, textStatus };
}

test('raw fields use the matching group heading and observed image count', (t) => {
  const document = createDOM(t, '<h1>Rooms in District 7</h1><div role="feed"></div>');
  const post = appendPost(document, '123');
  const result = extractPost(post, { baseUrl: BASE_URL });
  assert.equal(result.raw_text, 'Group: Rooms in District 7\n\nStudio 123.');
  assert.equal(result.image_count, 1);
  assert.equal(result.rental_status, null);
  assert.equal(result.extracted, 0);
  assert.equal(result.listing_count, null);
});

test('group names are resolved from the post and never borrowed from a different group', (t) => {
  const document = createDOM(t, '<h1>Other group</h1><div role="feed"></div>');
  const post = appendPost(document, '123');
  const groupLink = document.createElement('a');
  groupLink.href = '/groups/42/';
  groupLink.textContent = 'Room group';
  post.firstElementChild.prepend(groupLink);
  assert.equal(extractPost(post, { baseUrl: 'https://www.facebook.com/groups/99/' }).raw_text,
    'Group: Room group\n\nStudio 123.');
  groupLink.remove();
  assert.equal(extractPost(post, { baseUrl: 'https://www.facebook.com/groups/99/' }).raw_text, 'Studio 123.');
});

test('numeric author group ID and group permalink slug identify the same page heading', (t) => {
  const document = createDOM(t, '<h1>Rooms in District 7</h1><div role="feed"></div>');
  const post = appendPost(document, '123');
  post.querySelector('[data-ad-rendering-role="profile_name"] a').href = '/groups/987/user/10/';
  post.querySelector('a[href*="/posts/"]').href = '/groups/room-group/posts/123/';
  const result = extractPost(post, { baseUrl: 'https://www.facebook.com/groups/987/' });
  assert.equal(result.raw_text, 'Group: Rooms in District 7\n\nStudio 123.');
  assert.equal(extractPost(post, { baseUrl: 'https://www.facebook.com/search/posts/?q=room' }).groupName, null);
});

test('the frozen Facebook feed matches independently reviewed records', { skip: !hasRealSamples }, (t) => {
  const html = fs.readFileSync(path.join(__dirname, 'fixtures/facebook-feed.html'), 'utf8');
  const expected = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/expected-posts.json'), 'utf8'));
  const document = createDOM(t, html);
  const actual = collectPosts(document, { baseUrl: 'https://www.facebook.com/groups/example-group/' });

  assert.equal(actual.length, 3);
  assert.deepEqual(actual.map(selectedFields), expected.map(selectedFields));
  assert.equal(new Set(actual.map((post) => post.postId)).size, 3);
  assert.ok(actual.every((post) => post.images.length === 5));
  assert.ok(actual.every((post) => post.imageStatus === 'visible-only'));
});

test('all supported message markers work without generated CSS classes', (t) => {
  const markers = [
    'data-ad-rendering-role="story_message"',
    'data-ad-preview="message"',
    'data-ad-comet-preview="message"',
  ];
  const document = createDOM(t, `<div role="feed">${markers.map((marker, index) => postHTML(String(9000 + index), { marker })).join('')}</div>`);
  document.querySelectorAll('[class]').forEach((element) => element.removeAttribute('class'));

  const posts = collectPosts(document, { baseUrl: BASE_URL });
  assert.deepEqual(posts.map((post) => post.postId), ['9000', '9001', '9002']);
  assert.deepEqual(posts.map((post) => post.text), ['Studio 9000.', 'Studio 9001.', 'Studio 9002.']);
});

test('a text-only post keeps emoji text and excludes comment text', (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9010', {
    text: 'Bright <img alt="🏠" src="https://static.xx.fbcdn.net/emoji.png"> studio.<br>Available now.',
    images: false,
    comments: '<div role="article" aria-label="Comment by Alex">Unrelated comment <img alt="📢" src="https://static.xx.fbcdn.net/comment-emoji.png"></div>',
  })}</div>`);
  const root = document.querySelector('[data-virtualized]');
  const post = extractPost(root, { baseUrl: BASE_URL });

  assert.ok(post);
  assert.match(post.text, /Bright 🏠 studio\./);
  assert.match(post.text, /Available now\./);
  assert.doesNotMatch(post.text, /Unrelated comment|📢/);
  assert.deepEqual(post.images, []);
  assert.equal(post.postUrl, 'https://www.facebook.com/groups/42/posts/9010/');
  assert.equal(post.linkSource, 'permalink');
  assert.equal(post.textStatus, 'visible');
});

test('photo set identity resolves a post link and excludes comment photos', (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9020', {
    directLink: false,
    comments: `<div role="article" aria-label="Comment by Alex">A comment ${imageHTML('9999')}<img src="https://static.xx.fbcdn.net/reaction.png"></div>`,
  })}</div>`);
  const [post] = collectPosts(document, { baseUrl: BASE_URL });

  assert.equal(post.postId, '9020');
  assert.equal(post.postUrl, 'https://www.facebook.com/groups/42/posts/9020/');
  assert.equal(post.linkSource, 'photo-set');
  assert.deepEqual(post.images, ['https://scontent.example.fbcdn.net/9020-a.jpg?token=keep']);
});

test('a comment permalink can resolve the parent post without including the comment', (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9030', {
    directLink: false,
    images: false,
    comments: '<div role="article" aria-label="Comment by Alex">Not post content<a href="https://www.facebook.com/groups/42/posts/9030/?comment_id=888&__tn__=R-R">1h</a></div>',
  })}</div>`);
  const [post] = collectPosts(document, { baseUrl: BASE_URL });

  assert.equal(post.postUrl, 'https://www.facebook.com/groups/42/posts/9030/');
  assert.equal(post.linkSource, 'comment-link');
  assert.equal(post.text, 'Studio 9030.');
});

test('the observer discovers existing posts and newly added nested batches once', async (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9040')}</div>`);
  const { observer, records } = startObserver(t, document);
  await observer.flush();
  assert.deepEqual(records().map((post) => post.postId), ['9040']);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `<section>${postHTML('9041')}${postHTML('9042')}</section>`;
  document.querySelector('[role="feed"]').append(wrapper);
  await observer.flush();
  await observer.flush();

  assert.deepEqual(records().map((post) => post.postId), ['9040', '9041', '9042']);
});

test('a partially built post waits for identity and updates when a lazy image src arrives', async (t) => {
  const document = createDOM(t);
  const { observer, records } = startObserver(t, document);
  await observer.flush();
  const root = appendPost(document, '9050', { text: '', directLink: false, images: false });
  await observer.flush();
  assert.equal(records().length, 0);

  root.querySelector('[data-ad-rendering-role="story_message"]').textContent = 'Newly loaded text.';
  await observer.flush();
  assert.equal(records().length, 0, 'a text-only candidate without a Facebook identity stays pending');

  const permalink = document.createElement('a');
  permalink.href = '/groups/42/posts/9050/';
  root.append(permalink);
  await observer.flush();
  assert.equal(records().length, 1);
  assert.equal(records()[0].text, 'Newly loaded text.');

  const photo = document.createElement('a');
  photo.href = '/photo/?fbid=905001&set=pcb.9050';
  const img = document.createElement('img');
  photo.append(img);
  root.querySelector('.random-content').append(photo);
  await observer.flush();
  img.src = 'https://scontent.example.fbcdn.net/lazy.jpg?token=keep';
  await observer.flush();

  assert.equal(records().length, 2);
  assert.equal(records()[1].postId, '9050');
  assert.deepEqual(records()[1].images, ['https://scontent.example.fbcdn.net/lazy.jpg?token=keep']);
});

test('comment chatter and presentation changes do not emit unchanged records', async (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9060')}</div>`);
  const { observer, records } = startObserver(t, document);
  await observer.flush();
  const root = document.querySelector('[data-virtualized]');
  root.className = 'another-generated-class';
  root.setAttribute('aria-busy', 'false');
  root.insertAdjacentHTML('beforeend', '<div role="article" aria-label="Comment by Alex">Hello <img src="https://static.xx.fbcdn.net/emoji.png"></div>');
  await observer.flush();
  root.querySelector('[role="article"]').firstChild.textContent = 'Edited comment';
  await observer.flush();

  assert.equal(records().length, 1);
});

test('text and image changes emit updates under the same canonical post identity', async (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9070')}</div>`);
  const { observer, records } = startObserver(t, document);
  await observer.flush();
  const root = document.querySelector('[data-virtualized]');
  root.querySelector('[data-ad-rendering-role="story_message"]').firstChild.textContent = 'Updated studio details.';
  await observer.flush();
  root.querySelector('a[href*="/photo/"] img').src = 'https://scontent.example.fbcdn.net/replacement.jpg';
  await observer.flush();

  assert.equal(records().length, 3);
  assert.equal(new Set(records().map((post) => post.postUrl)).size, 1);
  assert.equal(records()[1].text, 'Updated studio details.');
  assert.deepEqual(records()[2].images, ['https://scontent.example.fbcdn.net/replacement.jpg']);
});

test('See more expands asynchronously once without an observer feedback loop', async (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9080', {
    text: 'Short preview… <div role="button">See more</div>',
  })}</div>`);
  const message = document.querySelector('[data-ad-rendering-role="story_message"]');
  const button = message.querySelector('[role="button"]');
  let clicks = 0;
  button.addEventListener('click', () => {
    clicks += 1;
    document.defaultView.setTimeout(() => { message.textContent = 'The complete studio description.'; }, 5);
  });
  const { observer, records } = startObserver(t, document, { expand: true, expansionTimeoutMs: 100 });
  await observer.flush();
  await observer.flush();

  assert.equal(clicks, 1);
  assert.equal(records().length, 1);
  assert.equal(records()[0].text, 'The complete studio description.');
  assert.equal(records()[0].textStatus, 'expanded');
});

test('Vietnamese expansion targets only the post message, never comment buttons', async (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9090', {
    text: 'Nội dung ngắn… <span role="button">Xem thêm</span>',
    comments: '<div role="article" aria-label="Comment by Alex">Comment preview<span role="button">See more</span></div>',
  })}</div>`);
  const message = document.querySelector('[data-ad-rendering-role="story_message"]');
  let postClicks = 0;
  let commentClicks = 0;
  message.querySelector('[role="button"]').addEventListener('click', () => {
    postClicks += 1;
    message.textContent = 'Nội dung đầy đủ.';
  });
  document.querySelector('[role="article"] [role="button"]').addEventListener('click', () => { commentClicks += 1; });
  const { observer, records } = startObserver(t, document, { expand: true });
  await observer.flush();

  assert.equal(postClicks, 1);
  assert.equal(commentClicks, 0);
  assert.equal(records()[0].text, 'Nội dung đầy đủ.');
  assert.equal(records()[0].textStatus, 'expanded');
});

test('an unresponsive expansion remains partial and is not clicked again', async (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9100', {
    text: 'Still truncated… <span role="button">See more</span>',
  })}</div>`);
  const root = document.querySelector('[data-virtualized]');
  let clicks = 0;
  root.querySelector('[role="button"]').addEventListener('click', () => { clicks += 1; });
  const { observer, records } = startObserver(t, document, { expand: true });
  await observer.flush();
  root.insertAdjacentHTML('beforeend', '<span aria-hidden="true">Presentation update</span>');
  await observer.flush();

  assert.equal(clicks, 1);
  assert.equal(records().length, 1);
  assert.equal(records()[0].text, 'Still truncated…');
  assert.equal(records()[0].textStatus, 'partial');
});

test('removing and reinserting a known post does not duplicate it', async (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9110')}</div>`);
  const { observer, records } = startObserver(t, document);
  await observer.flush();
  const root = document.querySelector('[data-virtualized]');
  root.remove();
  await observer.flush();
  document.querySelector('[role="feed"]').append(root);
  await observer.flush();

  assert.equal(records().length, 1);
});

test('a detached queued candidate does not crash and can be discovered later', async (t) => {
  const document = createDOM(t);
  const { observer, records } = startObserver(t, document);
  await observer.flush();
  const root = appendPost(document, '9120');
  root.remove();
  await observer.flush();
  document.querySelector('[role="feed"]').append(root);
  await observer.flush();

  assert.equal(records().length, 1);
  assert.equal(records()[0].postId, '9120');
});

test('stop disconnects collection before future DOM changes', async (t) => {
  const document = createDOM(t);
  const { observer, records } = startObserver(t, document);
  await observer.flush();
  observer.stop();
  appendPost(document, '9130');
  await observer.flush();

  assert.deepEqual(records(), []);
});

test('the real feed still matches expected data after every class attribute is removed', { skip: !hasRealSamples }, (t) => {
  const html = fs.readFileSync(path.join(__dirname, 'fixtures/facebook-feed.html'), 'utf8');
  const expected = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/expected-posts.json'), 'utf8'));
  const document = createDOM(t, html);
  document.querySelectorAll('[class]').forEach((element) => element.removeAttribute('class'));

  const actual = collectPosts(document, { baseUrl: 'https://www.facebook.com/groups/example-group/' });

  assert.deepEqual(actual.map(selectedFields), expected.map(selectedFields));
});

test('an image src change updates its own post inside a wrapper containing multiple posts', async (t) => {
  const document = createDOM(t, `<div role="feed"><section>${postHTML('9140')}${postHTML('9141')}</section></div>`);
  const { observer, records } = startObserver(t, document);
  await observer.flush();
  assert.equal(records().length, 2);

  const roots = document.querySelectorAll('[data-virtualized]');
  roots[1].querySelector('a[href*="/photo/"] img').src = 'https://scontent.example.fbcdn.net/wrapped-lazy.jpg';
  await observer.flush();

  assert.equal(records().length, 3);
  assert.equal(records()[2].postId, '9141');
  assert.deepEqual(records()[2].images, ['https://scontent.example.fbcdn.net/wrapped-lazy.jpg']);
  assert.equal(records().filter((post) => post.postId === '9140').length, 1);
});

test('nested aliases for the same message emit one post with one copy of its text', async (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9150', {
    text: '<div data-ad-preview="message"><div data-ad-comet-preview="message">A single message.</div></div>',
  })}</div>`);
  const { observer, records } = startObserver(t, document);
  await observer.flush();

  assert.equal(records().length, 1);
  assert.equal(records()[0].postId, '9150');
  assert.equal(records()[0].text, 'A single message.');
});

test('script payloads are neither interpreted as posts nor executed during extraction', (t) => {
  const fakePost = postHTML('9999', { text: 'A fake embedded post.' });
  const document = createDOM(t, `<div role="feed">${postHTML('9160', {
    text: 'Real message.<script>window.collectorScriptExecuted = true;</script>',
  })}</div><script type="application/json">${JSON.stringify({ html: fakePost })}</script>`);

  assert.equal(document.defaultView.collectorScriptExecuted, undefined);
  const posts = collectPosts(document, { baseUrl: BASE_URL });

  assert.equal(document.defaultView.collectorScriptExecuted, undefined);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].postId, '9160');
  assert.equal(posts[0].text, 'Real message.');
  assert.doesNotMatch(posts[0].text, /collectorScriptExecuted|embedded post/);
});

test('removing the only image emits a record with an empty image set', async (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9170')}</div>`);
  const { observer, records } = startObserver(t, document);
  await observer.flush();
  assert.equal(records()[0].images.length, 1);

  document.querySelector('a[href*="/photo/"]').remove();
  await observer.flush();

  assert.equal(records().length, 2);
  assert.equal(records()[1].postId, '9170');
  assert.equal(records()[1].text, 'Studio 9170.');
  assert.deepEqual(records()[1].images, []);
});

test('appending one new feed card does not traverse an unchanged existing card again', async (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9180')}</div>`);
  const { observer, records } = startObserver(t, document);
  await observer.flush();

  const oldCard = document.querySelector('[data-virtualized]');
  const originalQuery = oldCard.querySelectorAll;
  let oldCardTraversals = 0;
  oldCard.querySelectorAll = function (...args) {
    oldCardTraversals += 1;
    return originalQuery.apply(this, args);
  };
  t.after(() => { oldCard.querySelectorAll = originalQuery; });

  appendPost(document, '9181');
  await observer.flush();

  assert.deepEqual(records().map((post) => post.postId), ['9180', '9181']);
  assert.equal(oldCardTraversals, 0, 'new-card discovery must not scan the unchanged old card');
});

test('an inline hidden ancestor prevents its message and photos from being collected', (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9190')}</div>`);
  const root = document.querySelector('[data-virtualized]');
  root.querySelector('.random-content').style.display = 'none';

  assert.deepEqual(collectPosts(document, { baseUrl: BASE_URL }), []);
});

test('an unrelated preview permalink cannot override the post photo-set identity', (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9200', { directLink: false })}</div>`);
  const root = document.querySelector('[data-virtualized]');
  root.insertAdjacentHTML('beforeend', '<aside><a href="/groups/42/posts/9999/">An unrelated link preview</a></aside>');

  const post = extractPost(root, { baseUrl: BASE_URL });

  assert.ok(post === null || post.postId === '9200', 'conflicting evidence must be rejected or resolved to the actual post');
});

test('a header avatar linked through photo.php is not included as post media', (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9210')}</div>`);
  const root = document.querySelector('[data-virtualized]');
  root.firstElementChild.insertAdjacentHTML('afterbegin', '<a href="/photo.php?fbid=7777" aria-label="Author profile picture"><img width="40" height="40" alt="Author profile picture" src="https://scontent.example.fbcdn.net/avatar.jpg"></a>');

  const [post] = collectPosts(document, { baseUrl: BASE_URL });

  assert.deepEqual(post.images, ['https://scontent.example.fbcdn.net/9210-a.jpg?token=keep']);
});

test('a failed delivery is retried by the next flush without losing the record', async (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9220')}</div>`);
  let attempts = 0;
  const delivered = [];
  const observer = observePosts({
    document,
    expand: false,
    debounceMs: 1000,
    onPosts(posts) {
      attempts += 1;
      if (attempts === 1) throw new Error('Temporary delivery failure');
      delivered.push(...posts);
    },
  });
  t.after(() => observer.stop());

  await assert.rejects(observer.flush(), /Temporary delivery failure/);
  await observer.flush();

  assert.equal(attempts, 2);
  assert.deepEqual(delivered.map((post) => post.postId), ['9220']);
});

test('stop promptly cancels an active See more wait without emitting a record', async (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9230', {
    text: 'A pending preview… <span role="button">See more</span>',
  })}</div>`);
  const button = document.querySelector('[role="button"]');
  const started = new Promise((resolve) => button.addEventListener('click', resolve, { once: true }));
  const delivered = [];
  const observer = observePosts({
    document,
    expand: true,
    expansionTimeoutMs: 5000,
    debounceMs: 1000,
    onPosts: (posts) => delivered.push(...posts),
  });
  t.after(() => observer.stop());
  const draining = observer.flush();
  await started;
  observer.stop();

  let deadline;
  try {
    await Promise.race([
      draining,
      new Promise((_, reject) => {
        deadline = setTimeout(() => reject(new Error('Collection did not stop promptly')), 100);
      }),
    ]);
  } finally {
    clearTimeout(deadline);
  }
  assert.deepEqual(delivered, []);
});

test('a Marketplace listing shared in a group is saved under its listing id', (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9290', { directLink: false, images: false })}</div>`);
  const card = document.querySelector('[role="feed"] > *');
  card.insertAdjacentHTML('afterbegin', '<a href="/groups/888/">Phòng trọ thử</a><a href="/groups/888/user/10/">Người đăng</a>');
  card.querySelector('.random-content').insertAdjacentHTML('beforeend',
    '<a href="/commerce/listing/77001/?media_id=1"><img src="https://scontent.example.fbcdn.net/77001-a.jpg"></a>' +
    '<a href="/commerce/listing/77001/?ref=share_attachment">4.500.000 ₫ · Gò Vấp</a>');

  const [post] = collectPosts(document, { baseUrl: 'https://www.facebook.com/search/posts/?q=tro' });

  assert.equal(post.postId, '77001');
  assert.equal(post.postUrl, 'https://www.facebook.com/marketplace/item/77001/');
  assert.equal(post.linkSource, 'marketplace');
  assert.equal(post.groupId, '888');
  assert.equal(post.groupName, 'Phòng trọ thử');
  assert.deepEqual(post.images, ['https://scontent.example.fbcdn.net/77001-a.jpg']);
});

test('a group post that links a listing keeps its own post id', (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9291', { directLink: false })}</div>`);
  const card = document.querySelector('[role="feed"] > *');
  card.insertAdjacentHTML('afterbegin', '<a href="/groups/888/">Phòng trọ thử</a>');
  card.querySelector('.random-content').insertAdjacentHTML('beforeend', '<a href="/commerce/listing/77002/">Tin khác</a>');

  const [post] = collectPosts(document, { baseUrl: 'https://www.facebook.com/search/posts/?q=tro' });

  assert.equal(post.postUrl, 'https://www.facebook.com/groups/888/posts/9291/');
  assert.equal(post.linkSource, 'photo-set');
});

test('a changed HTML comment is ignored without an error', async (t) => {
  const document = createDOM(t, '<div role="feed"><!--placeholder--></div>');
  const errors = [];
  document.defaultView.addEventListener('error', event => errors.push(event.message));
  const { records } = startObserver(t, document);
  document.querySelector('[role="feed"]').firstChild.data = 'facebook changed this';
  appendPost(document, '9280');
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.deepEqual(errors, []);
  assert.deepEqual(records().map(record => record.postId), ['9280']);
});

test('a group post with a single photo is identified from its gm photo set', (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9270', { directLink: false, images: false })}</div>`);
  const card = document.querySelector('[role="feed"] > *');
  card.insertAdjacentHTML('afterbegin', '<a href="/groups/888/">Phòng trọ thử</a>');
  card.querySelector('.random-content').insertAdjacentHTML('beforeend',
    '<a href="/photo/?fbid=927001&set=gm.9270&idorvanity=888"><img src="https://scontent.example.fbcdn.net/9270-a.jpg"></a>');

  const [post] = collectPosts(document, { baseUrl: 'https://www.facebook.com/search/posts/?q=tro' });

  assert.equal(post.postUrl, 'https://www.facebook.com/groups/888/posts/9270/');
  assert.equal(post.linkSource, 'photo-set');
  assert.deepEqual(post.images, ['https://scontent.example.fbcdn.net/9270-a.jpg']);
});

test('a search result finds its group from the card when the author link has none', (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9260', { directLink: false })}</div>`);
  const card = document.querySelector('[role="feed"] > *');
  document.querySelector('[data-ad-rendering-role="profile_name"] a').href = '/profile.php?id=10';
  card.insertAdjacentHTML('afterbegin', '<a href="/groups/888/">Phòng trọ thử</a><a href="/groups/888/user/10/">Người đăng</a>');

  const [post] = collectPosts(document, { baseUrl: 'https://www.facebook.com/search/posts/?q=tro' });

  assert.equal(post.postUrl, 'https://www.facebook.com/groups/888/posts/9260/');
  assert.equal(post.linkSource, 'photo-set');
  assert.equal(post.groupName, 'Phòng trọ thử');
});

test('a search result linking two groups stays unidentified', (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9261', { directLink: false })}</div>`);
  const card = document.querySelector('[role="feed"] > *');
  document.querySelector('[data-ad-rendering-role="profile_name"] a').href = '/profile.php?id=10';
  card.insertAdjacentHTML('afterbegin', '<a href="/groups/888/">Nhóm A</a><a href="/groups/999/">Nhóm B</a>');

  assert.deepEqual(collectPosts(document, { baseUrl: 'https://www.facebook.com/search/posts/?q=tro' }), []);
});

test('photo-set identity uses the post author group instead of the page group', (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9240', { directLink: false })}</div>`);
  document.querySelector('[data-ad-rendering-role="profile_name"] a').href = '/groups/555/user/10/';

  const [post] = collectPosts(document, { baseUrl: BASE_URL });

  assert.equal(post.postId, '9240');
  assert.equal(post.postUrl, 'https://www.facebook.com/groups/555/posts/9240/');
  assert.equal(post.linkSource, 'photo-set');
});

test('posts from different groups keep their own group identities in one feed', (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9250', { directLink: false })}${postHTML('9251', { directLink: false })}</div>`);
  const profiles = document.querySelectorAll('[data-ad-rendering-role="profile_name"] a');
  profiles[0].href = '/groups/555/user/10/';
  profiles[1].href = '/groups/777/user/20/';

  const posts = collectPosts(document, { baseUrl: 'https://www.facebook.com/search/groups/?q=rent' });

  assert.deepEqual(posts.map((post) => post.postUrl), [
    'https://www.facebook.com/groups/555/posts/9250/',
    'https://www.facebook.com/groups/777/posts/9251/',
  ]);
});

test('the second real Facebook snapshot resolves all four posts from their own group', { skip: !hasRealSamples }, (t) => {
  const html = fs.readFileSync(path.join(__dirname, 'fixtures/facebook-search.html'), 'utf8');
  const expected = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/expected-search-posts.json'), 'utf8'));
  const document = createDOM(t, html);
  const posts = collectPosts(document, { baseUrl: 'https://www.facebook.com/search/groups/?q=rent' });
  const expectedIds = ['2674708403026204', '2679645382532506', '2679639712533073', '2679118892585155'];

  assert.deepEqual(posts.map((post) => post.postId), expectedIds);
  assert.deepEqual(posts.map((post) => post.postUrl), expectedIds.map((id) => `https://www.facebook.com/groups/1533175387179517/posts/${id}/`));
  assert.ok(posts.every((post) => post.images.length === 5));
  assert.ok(posts.every((post) => post.textStatus === 'partial'));
  assert.deepEqual(posts.map(selectedFields), expected.map(selectedFields));
});

test('Show more asynchronously reveals the complete body and Show less marks it expanded', async (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9260', {
    text: 'Preview only… <span role="button">Show more</span>',
  })}</div>`);
  const message = document.querySelector('[data-ad-rendering-role="story_message"]');
  let clicks = 0;
  message.querySelector('[role="button"]').addEventListener('click', () => {
    clicks += 1;
    document.defaultView.setTimeout(() => {
      message.innerHTML = 'A complete room description.<br>Rent is 3000000 VND per month.<span role="button">Show less</span>';
    }, 5);
  });
  const { observer, records } = startObserver(t, document, { expand: true, expansionTimeoutMs: 100 });
  await observer.flush();
  await observer.flush();

  assert.equal(clicks, 1);
  assert.equal(records().length, 1);
  assert.equal(records()[0].text, 'A complete room description.\nRent is 3000000 VND per month.');
  assert.equal(records()[0].textStatus, 'expanded');
  assert.doesNotMatch(records()[0].text, /Show more|Show less/);
});

test('replacing a failed Show more button or its card does not retry the same preview', async (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9270', {
    text: 'The same incomplete preview… <span role="button">Show more</span>',
  })}</div>`);
  let clicks = 0;
  const registerClick = (button) => button.addEventListener('click', () => { clicks += 1; });
  let root = document.querySelector('[data-virtualized]');
  registerClick(root.querySelector('[role="button"]'));
  const { observer, records } = startObserver(t, document, { expand: true });
  await observer.flush();
  assert.equal(clicks, 1);
  assert.equal(records()[0].textStatus, 'partial');

  const oldButton = root.querySelector('[role="button"]');
  const replacementButton = oldButton.cloneNode(true);
  registerClick(replacementButton);
  oldButton.replaceWith(replacementButton);
  await observer.flush();
  assert.equal(clicks, 1);

  const replacementCard = root.cloneNode(true);
  registerClick(replacementCard.querySelector('[role="button"]'));
  root.replaceWith(replacementCard);
  root = replacementCard;
  await observer.flush();
  await observer.flush();

  assert.equal(clicks, 1);
  assert.equal(records().length, 1);
  assert.equal(records()[0].text, 'The same incomplete preview…');
  assert.equal(records()[0].textStatus, 'partial');
});

test('content arriving after an expansion timeout updates partial output to expanded once', async (t) => {
  const document = createDOM(t, `<div role="feed">${postHTML('9280', {
    text: 'A slow preview… <span role="button">Show more</span>',
  })}</div>`);
  const message = document.querySelector('[data-ad-rendering-role="story_message"]');
  let clicks = 0;
  message.querySelector('[role="button"]').addEventListener('click', () => { clicks += 1; });
  const { observer, records } = startObserver(t, document, { expand: true, expansionTimeoutMs: 10 });
  await observer.flush();
  assert.equal(records().length, 1);
  assert.equal(records()[0].textStatus, 'partial');

  await new Promise((resolve) => document.defaultView.setTimeout(() => {
    message.innerHTML = 'The full description arrived later.<span role="button">See less</span>';
    resolve();
  }, 5));
  await observer.flush();
  await observer.flush();

  assert.equal(clicks, 1);
  assert.equal(records().length, 2);
  assert.equal(records()[1].text, 'The full description arrived later.');
  assert.equal(records()[1].textStatus, 'expanded');
});

test('navigation text updates outside the feed do not traverse existing post cards', async (t) => {
  const document = createDOM(t, `<nav>Notifications</nav><div role="feed">${postHTML('9290')}</div>`);
  const { observer, records } = startObserver(t, document);
  await observer.flush();
  const card = document.querySelector('[data-virtualized]');
  const original = card.querySelectorAll.bind(card);
  let traversals = 0;
  card.querySelectorAll = (...args) => { traversals += 1; return original(...args); };
  document.querySelector('nav').firstChild.nodeValue = 'New notification';
  await observer.flush();
  assert.equal(traversals, 0);
  assert.equal(records().length, 1);
});

test('the extension classic scripts expose a usable snapshot in their isolated context', async (t) => {
  const dom = new JSDOM(`<div role="feed">${postHTML('9300')}</div>`, {
    url: BASE_URL,
    runScripts: 'outside-only',
  });
  t.after(() => { dom.window.troCollector?.stop(); dom.window.close(); });
  dom.window.chrome = { runtime: { sendMessage: async () => ({ ok: true, saved: 1 }) } };
  const logs = [];
  dom.window.console.info = (...args) => logs.push(args);
  dom.window.eval(fs.readFileSync(path.join(__dirname, '../extension/collector.js'), 'utf8'));
  dom.window.eval(fs.readFileSync(path.join(__dirname, '../extension/privacy.js'), 'utf8'));
  dom.window.eval(fs.readFileSync(path.join(__dirname, '../extension/content-script.js'), 'utf8'));
  await dom.window.troCollector.flush();
  assert.equal(dom.window.troCollector.snapshot().length, 1);
  assert.equal(dom.window.troCollector.snapshot()[0].postId, '9300');
  assert.equal(logs.length, 1);
});
