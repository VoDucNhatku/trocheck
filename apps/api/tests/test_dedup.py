from app.pipeline.dedup import DedupConfig, DedupItem, TfIdf, decide

TEXT = "Cho thuê CCMN 1PN 30m2 phường Cầu Giấy, giá 5tr/th/phòng, full nội thất, điện 3k5/số"


def item(i, text=TEXT, **kw):
    base = dict(listing_id=f"L{i}", cluster_id=f"C{i}", post_id=f"P{i}", property_type="ccmn",
                ward_code="W1", landmark_key=None, area_m2=30.0, rent_vnd=5_000_000, text=text)
    base.update(kw)
    return DedupItem(**base)


def test_repost_is_merged():
    docs = [TEXT, TEXT + " LH [SĐT]", "Phòng trọ khép kín gần chợ 2tr8"]
    d = decide(item(1), [item(2, TEXT + " LH [SĐT]")], TfIdf(docs), DedupConfig())
    assert d.action == "merge" and d.cluster_id == "C2"


def test_same_template_different_room_is_not_merged():
    # Broker reuses a template: high cosine, but area and price differ -> conditions 2-3 stop it.
    d = decide(item(1), [item(2, area_m2=45.0, rent_vnd=7_000_000)], TfIdf([TEXT]), DedupConfig())
    assert d.action == "separate"


def test_middle_similarity_is_suggested():
    other = "CCMN 1PN 30m2 Cầu Giấy giá 5tr, ban công rộng, thang máy, chỗ để xe, gần trường học"
    d = decide(item(1), [item(2, other)], TfIdf([TEXT, other]), DedupConfig(suggest_cosine=0.1, auto_cosine=0.99))
    assert d.action == "suggest"


def test_same_post_is_never_a_duplicate():
    d = decide(item(1), [item(2, post_id="P1")], TfIdf([TEXT]), DedupConfig())
    assert d.action == "separate"
