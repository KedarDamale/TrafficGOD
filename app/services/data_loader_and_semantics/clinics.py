from __future__ import annotations

USER_MAP_LOCATIONS: dict[int, str] = {
    70688: "Powai",
    70689: "Mulund",
    70690: "Ghatkopar",
    70691: "Vashi",
    70692: "Andheri",
    70693: "Bandra",
    70694: "Charni Road",
    70696: "Safdarjung",
    70697: "GK",
}


def clinic_label(user_map_id: int) -> str:
    return USER_MAP_LOCATIONS.get(user_map_id, f"clinic_{user_map_id}")
