"""Public real-data reads must stay honest with a seeded demo store and tiny samples."""
from sqlalchemy import func, select

from app.models import Listing, Post
from app.services.seed import seed_demo
from tests.conftest import PASSWORD, batch, post_payload

V1 = '/api/v1'
TEXTS = [
    'Cho thuê CCMN 1PN 30m2 phường Tăng Nhơn Phú, giá 5tr/tháng/phòng, cọc 1 tháng. Ban công hướng đông.',
    'Cho thuê phòng trọ khép kín 22m2 phường Linh Xuân, giá 3tr2/tháng/phòng. Cửa sổ gần vườn.',
    'Chính chủ cho thuê nhà nguyên căn 80m2 phường Hiệp Bình, giá 12tr/tháng/căn. Sân để xe riêng.',
    'Cho thuê căn hộ dịch vụ 35m2 phường An Khánh, giá 7tr/tháng/phòng. Bếp riêng có tủ lạnh.',
    'Cho thuê phòng tại phường Tăng Nhơn Phú. Giá liên hệ để trao đổi, chưa ghi diện tích.',
    'Cho thuê phòng trọ 25m2 phường Linh Xuân, giá 3tr/tháng hoặc 3tr5/tháng tùy thời điểm.',
]


def test_seeded_demo_posts_stay_stored_but_hidden_from_all_real_public_reads(api):
    with api.session() as session:
        seed_demo(session, password=PASSWORD)
    api.drain()
    with api.session() as session:
        demo_id = session.scalar(select(Listing.id).join(Post, Post.id == Listing.post_id).where(Post.is_demo.is_(True)))
        assert session.scalar(select(func.count()).select_from(Post).where(Post.is_demo.is_(True))) > 0
    public = api.client()
    for query in ['', '?demo=true', '?demo=false']:
        listings = public.get(V1 + '/listings' + query).json()
        assert listings['is_demo'] is False and listings['total'] == 0 and listings['items'] == []
        stats = public.get(V1 + '/stats/overview' + query).json()
        assert stats['is_demo'] is False and stats['total_listings'] == stats['eligible_listings'] == 0
        assert stats['updated_at'] is None
        market = public.get(V1 + '/market/summary' + query).json()
        assert market['is_demo'] is False and market['cells'] == []
        assert market['data_from'] is market['data_to'] is None
        assert public.get(f'{V1}/listings/{demo_id}' + query).status_code == 404
        assert public.get(f'{V1}/listings/{demo_id}/comparison' + query).status_code == 404


def test_renter_ingest_publishes_only_accepted_real_listings_without_small_sample_means(api):
    renter = api.client('renter')
    response = renter.post(V1 + '/ingest/batch', json=batch(*[
        post_payload(f'real-public-{i}', text, source_type='manual_paste') for i, text in enumerate(TEXTS)
    ]))
    assert response.status_code == 200 and response.json()['summary']['created'] == 6
    assert api.drain() == 6
    with api.session() as session:
        statuses = dict(session.execute(select(Listing.review_status, func.count()).group_by(Listing.review_status)).all())
        assert statuses == {'auto_accepted': 4, 'needs_review': 2}
        pending_ids = set(session.scalars(select(Listing.id).where(Listing.review_status == 'needs_review')))
    public = api.client()
    listings = public.get(V1 + '/listings').json()
    assert listings['is_demo'] is False and listings['total'] == 4
    assert not pending_ids.intersection(item['listing_id'] for item in listings['items'])
    stats = public.get(V1 + '/stats/overview').json()
    assert stats['total_listings'] == 6 and stats['eligible_listings'] == 4 and stats['updated_at']
    market = public.get(V1 + '/market/summary').json()
    assert market['cells'] and market['is_demo'] is False
    for cell in market['cells']:
        assert cell['n'] == 1 and cell['mean_vnd'] is None and cell['mean_per_m2'] is None
    for item in listings['items']:
        listing_id = item['listing_id']
        assert public.get(f'{V1}/listings/{listing_id}').status_code == 200
        comparison = public.get(f'{V1}/listings/{listing_id}/comparison').json()
        assert comparison['status'] == 'insufficient_data' and comparison['is_demo'] is False
        assert comparison['mean_vnd'] is comparison['delta_percent'] is comparison['verdict'] is None
        for similar in comparison['similar']:
            assert public.get(f"{V1}/listings/{similar['listing_id']}").status_code == 200
    for listing_id in pending_ids:
        assert public.get(f'{V1}/listings/{listing_id}').status_code == 404
