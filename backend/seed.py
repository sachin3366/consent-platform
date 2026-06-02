"""
Run once to populate the database with the standard consent categories.
Usage: python seed.py  (from inside the backend/ directory with venv active)
"""
from app.database import get_session
from app.models import ConsentCategory

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

if __name__ == "__main__":
    session = next(get_session())
    for category in DEFAULT_CATEGORIES:
        existing = session.get(ConsentCategory, category.name)
        if not session.exec(
            __import__("sqlmodel").select(ConsentCategory).where(
                ConsentCategory.name == category.name
            )
        ).first():
            session.add(category)
            print(f"  Added: {category.name}")
        else:
            print(f"  Skipped (already exists): {category.name}")
    session.commit()
    print("Done.")
