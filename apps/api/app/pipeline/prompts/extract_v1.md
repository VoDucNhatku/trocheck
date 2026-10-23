<!-- prompt_version: extract_v1 -->
You extract information from a Vietnamese rental post (Facebook group). Phone numbers are already masked as [SĐT].

Return ONLY a JSON object, no prose:

{"post_type": "<rental_offer|seeking|roommate|sale|spam|other>",
 "spans": [{"listing_index": <int>, "label": "<PRICE|AREA|LOC|ROOM|FEE>", "quote": "<exact text>"}]}

Rules:
1. `quote` must be copied character for character from the post (same accents, case and spacing). Never paraphrase, never convert numbers, never compute anything.
2. PRICE = the rent the landlord asks, including its unit words, e.g. "5tr5/th/phòng", "từ 4tr/tháng", "3 - 3,5tr", "6tr/tháng bao điện nước", or a hidden-price phrase such as "Giá ib", "giá thỏa thuận".
3. FEE = any other money: deposit, electricity, water, service, internet, parking. Include the fee word in the quote, e.g. "điện 3k5/số", "cọc 1 tháng", "wifi free". A deposit or a utility price is NEVER a PRICE.
4. AREA = floor area, e.g. "30m2", "25-35m2", "4x8m".
5. ROOM = property type and room features, e.g. "CCMN", "phòng trọ khép kín", "2PN1WC", "gác lửng", "full nội thất".
6. LOC = place words, e.g. "gần ĐH FPT", "Ngõ 12 Trần Phú", "phường Cầu Giấy". Do not guess a ward that is not written.
7. One post can offer several rooms. Use listing_index 0, 1, 2… in the order the rooms appear, and give each room its own PRICE/AREA/ROOM spans. Repeat shared spans (fees, location) for each room.
8. If the post is not offering a rental (someone looking for a room, a roommate request, a sale, spam), set post_type accordingly and return "spans": [].
9. If something is not in the post, leave it out. Do not invent.

Example (invented post):
Post: Cho thuê phòng trọ 20m2 có gác, giá 2tr8/tháng, cọc 1 tháng, điện 4k/số. Gần chợ Láng.
Output: {"post_type": "rental_offer", "spans": [
 {"listing_index": 0, "label": "ROOM", "quote": "phòng trọ"},
 {"listing_index": 0, "label": "AREA", "quote": "20m2"},
 {"listing_index": 0, "label": "ROOM", "quote": "có gác"},
 {"listing_index": 0, "label": "PRICE", "quote": "2tr8/tháng"},
 {"listing_index": 0, "label": "FEE", "quote": "cọc 1 tháng"},
 {"listing_index": 0, "label": "FEE", "quote": "điện 4k/số"},
 {"listing_index": 0, "label": "LOC", "quote": "Gần chợ Láng"}]}

Post:
{{POST_TEXT}}
