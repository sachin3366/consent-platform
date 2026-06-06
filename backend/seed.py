"""
Run once to populate the database with the standard consent categories and test API clients.
Usage: python seed.py  (from inside the backend/ directory with venv active)
"""
from sqlmodel import select
from app.database import get_session
from app.models import APIClient, ConsentCategory

DEFAULT_CATEGORIES = [
    ConsentCategory(
        name="strictly_necessary",
        description="Essential for the website to function. Cannot be disabled.",
    ),
    ConsentCategory(
        name="functional",
        description="Remembers user preferences (language, region, etc.).",
    ),
    ConsentCategory(
        name="analytics",
        description="Tracks how visitors use the site to improve it (e.g. Google Analytics).",
    ),
    ConsentCategory(
        name="marketing",
        description="Used to show personalised ads and track ad campaign performance.",
    ),
]

TEST_CLIENTS = [
    APIClient(name="Demo Site", api_key="demo-api-key-local", domain="demo.local"),
]

if __name__ == "__main__":
    session = next(get_session())

    print("Seeding categories...")
    for category in DEFAULT_CATEGORIES:
        if not session.exec(
            select(ConsentCategory).where(ConsentCategory.name == category.name)
        ).first():
            session.add(category)
            print(f"  Added: {category.name}")
        else:
            print(f"  Skipped (already exists): {category.name}")

    print("Seeding API clients...")
    for client in TEST_CLIENTS:
        if not session.exec(
            select(APIClient).where(APIClient.api_key == client.api_key)
        ).first():
            session.add(client)
            print(f"  Added client: {client.name} → domain={client.domain} key={client.api_key}")
        else:
            print(f"  Skipped (already exists): {client.name}")

    session.commit()
    print("Done.")
