from typing import NamedTuple


class CategoryRule(NamedTuple):
    default_accepted: bool
    locked: bool        # if True, user cannot change this toggle
    label: str | None = None  # override the display name shown in the banner


class JurisdictionConfig(NamedTuple):
    banner_title: str
    banner_subtitle: str
    requires_opt_in: bool   # True = opt-in flow (GDPR), False = opt-out flow (CCPA)
    button_label: str
    category_rules: dict[str, CategoryRule]


RULES: dict[str, JurisdictionConfig] = {
    "GDPR": JurisdictionConfig(
        banner_title="Cookie Preferences",
        banner_subtitle=(
            "We use cookies to improve your experience. "
            "No cookies are active until you give your consent."
        ),
        requires_opt_in=True,
        button_label="Save preferences",
        category_rules={
            "strictly_necessary": CategoryRule(default_accepted=True, locked=True),
            "functional":         CategoryRule(default_accepted=False, locked=False),
            "analytics":          CategoryRule(default_accepted=False, locked=False),
            "marketing":          CategoryRule(default_accepted=False, locked=False),
        },
    ),
    "CCPA": JurisdictionConfig(
        banner_title="Your Privacy Choices",
        banner_subtitle=(
            "Under California law you have the right to opt out of the sale "
            "of your personal information. All categories are active by default."
        ),
        requires_opt_in=False,
        button_label="Confirm choices",
        category_rules={
            "strictly_necessary": CategoryRule(default_accepted=True,  locked=True),
            "functional":         CategoryRule(default_accepted=True,  locked=False),
            "analytics":          CategoryRule(default_accepted=True,  locked=False),
            "marketing":          CategoryRule(
                default_accepted=True, locked=False,
                label="Do Not Sell My Personal Information",
            ),
        },
    ),
}

SUPPORTED = list(RULES.keys())
