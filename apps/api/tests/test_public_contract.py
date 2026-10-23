"""Public B1 DTOs must describe real serialized data without losing keys or nulls."""
from jsonschema import Draft202012Validator

from app.services import listings, market
from tests.test_api import seed


def validate_openapi(client, path, payload):
    schema = client.get('/openapi.json').json()
    response = schema['paths'][path]['get']['responses']['200']['content']['application/json']['schema']
    Draft202012Validator({**response, 'components': schema['components']}).validate(payload)


def test_empty_dates_errors_and_query_contract(api):
    client = api.client()
    data = client.get('/api/v1/listings').json()
    assert data == {'items': [], 'total': 0, 'hidden_no_price': 0, 'data_as_of': None,
                    'page': 1, 'page_size': 20, 'is_demo': False}
    validate_openapi(client, '/api/v1/listings', data)
    stats = client.get('/api/v1/stats/overview').json()
    assert stats['updated_at'] is None
    validate_openapi(client, '/api/v1/stats/overview', stats)
    schema = client.get('/openapi.json').json()
    params = schema['paths']['/api/v1/listings']['get']['parameters']
    for key in ('ward', 'type'):
        assert next(p for p in params if p['name'] == key)['schema']['type'] == 'array'
    error = client.get('/api/v1/listings/missing')
    assert error.status_code == 404 and error.json()['error']['request_id']
    Draft202012Validator({'$ref': '#/components/schemas/ErrorResponse', 'components': schema['components']}).validate(error.json())


def test_models_preserve_public_serializers_and_dataset_scope(api):
    seed(api)
    api.set_demo(True)
    client = api.client()
    page = client.get('/api/v1/listings', params={'page_size': 100}).json()
    validate_openapi(client, '/api/v1/listings', page)
    with api.session() as session:
        assert page == listings.search(session, api.settings, demo=True, page_size=100)
        for card in page['items']:
            lid = card['listing_id']
            listing = listings.get_visible(session, lid, demo=True)
            detail = client.get(f'/api/v1/listings/{lid}').json()
            assert detail == listings.detail(session, listing)
            validate_openapi(client, '/api/v1/listings/{listing_id}', detail)
            for field in ('rent', 'area', 'room', 'location'):
                for ev in detail['listing'][field]['evidence']:
                    assert detail['post']['text'][ev['start']:ev['end']] == ev['quote']
        lid = page['items'][0]['listing_id']
        comparison = client.get(f'/api/v1/listings/{lid}/comparison').json()
        assert comparison == market.comparison(session, listings.get_visible(session, lid, demo=True), api.settings)
        validate_openapi(client, '/api/v1/listings/{listing_id}/comparison', comparison)
    assert client.get('/api/v1/listings?demo=false').json()['total'] == 0
    assert client.get(f'/api/v1/listings/{lid}?demo=false').status_code == 404
    assert client.get(f'/api/v1/listings/{lid}/comparison?demo=false').status_code == 404
    assert client.get('/api/v1/stats/overview?demo=false').json()['total_listings'] == 0
    api.set_demo(False)
    assert client.get('/api/v1/listings?demo=true').json()['is_demo'] is False


def test_reseed_preserves_demo_rows_dates_and_does_not_enqueue_again(api, monkeypatch):
    from datetime import timedelta
    from sqlalchemy import select
    from app.models import Post
    from app.services import seed as seed_service

    seed(api)
    with api.session() as session:
        before = [(p.id, p.posted_at) for p in session.scalars(select(Post).order_by(Post.id))]
        later = seed_service.utcnow() + timedelta(minutes=2)
        monkeypatch.setattr(seed_service, 'utcnow', lambda: later)
        result = seed_service.seed_demo(session, password='seed-pass')
        after = [(p.id, p.posted_at) for p in session.scalars(select(Post).order_by(Post.id))]
    assert result['posts_created'] == 0
    assert before == after
    assert api.drain() == 0
