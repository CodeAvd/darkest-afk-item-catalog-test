#!/usr/bin/env python3
"""
Скрипт для автоматической генерации JSON-кодов для orphaned PNG иконок.
Строго следует правилу: не придумывать коды, если их нет в Item and Resources.txt
"""

import csv
import json
import re
from pathlib import Path
from typing import Optional, Dict, List

# Пути к файлам
ITEM_RESOURCES_PATH = Path("Item and Resources.txt")
ORPHANED_CSV_PATH = Path("orphaned_icons.csv")
OUTPUT_JSON = Path("orphaned_icons_with_codes.json")


def load_item_resources(path: Path) -> str:
    """Загружает содержимое Item and Resources.txt"""
    with path.open("r", encoding="utf-8", errors="ignore") as f:
        return f.read()


def has_id(text: str, id_str: str) -> bool:
    """Проверяет, что ID встречается в Item and Resources как отдельное слово"""
    # Ищем в кавычках или как item_name
    patterns = [
        r'"' + re.escape(id_str) + r'"',  # в кавычках
        r'\b' + re.escape(id_str) + r'\b',  # как отдельное слово
    ]
    return any(re.search(p, text) is not None for p in patterns)


def extract_item_snippet(text: str, item_id: str) -> Optional[str]:
    """
    Ищет в Item and Resources готовый JSON-блок для item_id
    и возвращает его целиком
    """
    # Ищем блок с "item_name" : "<item_id>"
    pattern = (
        r'\{\s*\n?'
        r'(?:[^{}]*\n)*?'
        r'.*?"item_name"\s*:\s*"' + re.escape(item_id) + r'"[^{}]*'
        r'\n?\s*\}'
    )
    match = re.search(pattern, text, re.MULTILINE)
    if match:
        return match.group(0)
    return None


def build_hero_snippet(hero_id: str) -> str:
    """
    Генерирует JSON snippet для героя
    """
    return (
        '{\n'
        f'  "type"      : "HERO",\n'
        f'  "hero_name" : "{hero_id}",\n'
        f'  "level"     : 1,\n'
        f'  "grade"     : 1\n'
        '}'
    )


def build_item_snippet(item_id: str, quantity: int = 1) -> str:
    """
    Генерирует базовый JSON snippet для item
    """
    return (
        '{\n'
        f'  "type"      : "ITEM",\n'
        f'  "item_name" : "{item_id}",\n'
        f'  "quantity"  : {quantity}\n'
        '}'
    )


def build_gear_snippet(gear_id: str) -> str:
    """
    Генерирует JSON snippet для gear
    """
    return (
        '{\n'
        f'  "type"      : "GEAR",\n'
        f'  "item_name" : "{gear_id}",\n'
        f'  "quantity"  : 1\n'
        '}'
    )


def process_orphaned_icons(item_resources_text: str, csv_path: Path) -> List[Dict]:
    """
    Обрабатывает CSV с orphaned иконками и генерирует маппинг к кодам
    """
    results: List[Dict] = []

    with csv_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            filename = row["filename"]
            category = row.get("category", "")
            suggested_id = row.get("suggested_id", "")
            display_name = row.get("suggested_display_name", "") or suggested_id

            mapped_id: Optional[str] = None
            code_snippet: Optional[str] = None
            reason: Optional[str] = None

            # ============================================================
            # 1) HERO ICONS: icon_hero_<name>[_<rarity>].png
            # ============================================================
            m_hero = re.match(r"icon_hero_([a-z0-9_]+?)(?:_(rare|epic|legendary))?\.png$", filename)
            if m_hero:
                hero_base = m_hero.group(1)
                hero_id = f"hero_{hero_base}"
                
                if has_id(item_resources_text, hero_id):
                    mapped_id = hero_id
                    code_snippet = build_hero_snippet(hero_id)
                else:
                    reason = f"Hero '{hero_id}' not found in Item and Resources.txt"

            # ============================================================
            # 2) HERO SKINS: hero_skin_<name>_<rarity>.png (уже есть в JSON, но проверим)
            # ============================================================
            elif filename.startswith("hero_skin_") and filename.endswith(".png"):
                # Извлекаем item_name из имени файла
                item_id = filename.replace(".png", "")
                # Корректируем некоторые known cases (с большой буквы)
                if item_id.startswith("Hero_skin"):
                    item_id = "item_" + item_id[0].lower() + item_id[1:]
                elif not item_id.startswith("item_"):
                    item_id = "item_" + item_id
                
                if has_id(item_resources_text, item_id):
                    mapped_id = item_id
                    snippet = extract_item_snippet(item_resources_text, item_id)
                    code_snippet = snippet or build_item_snippet(item_id, 1)
                else:
                    reason = f"Hero skin '{item_id}' not found in Item and Resources.txt"

            # ============================================================
            # 3) GEAR ICONS: gear_*_*.png
            # ============================================================
            elif filename.startswith("gear_") and filename.endswith(".png"):
                gear_id = filename.replace(".png", "")
                
                if has_id(item_resources_text, gear_id):
                    mapped_id = gear_id
                    code_snippet = build_gear_snippet(gear_id)
                else:
                    reason = f"Gear '{gear_id}' not found in Item and Resources.txt"

            # ============================================================
            # 4) EPIC WEAPON ICONS: <name>_epic_weapon_icon.png
            # ============================================================
            elif filename.endswith("_epic_weapon_icon.png"):
                # Это эпик-оружия героев - их НЕТ в Item and Resources
                reason = "Epic weapon icons are not in Item and Resources.txt (artwork only)"

            # ============================================================
            # 5) FALLEN HERO ICONS: icon_fallen_hero_*.png
            # ============================================================
            elif filename.startswith("icon_fallen_hero_"):
                reason = "Fallen hero icons are not in Item and Resources.txt"

            # ============================================================
            # 6) SIGNATURE ITEMS: signature_item_*_fragment.png
            # ============================================================
            elif filename.startswith("signature_item_") and "_fragment" in filename:
                item_id = filename.replace(".png", "")
                
                if has_id(item_resources_text, item_id):
                    mapped_id = item_id
                    snippet = extract_item_snippet(item_resources_text, item_id)
                    code_snippet = snippet or build_item_snippet(item_id, 50)
                else:
                    reason = f"Signature item '{item_id}' not found in Item and Resources.txt"

            # ============================================================
            # 7) GENERAL ITEMS: item_*.png
            # ============================================================
            elif filename.startswith("item_") and filename.endswith(".png"):
                item_id = filename.replace(".png", "")
                
                if has_id(item_resources_text, item_id):
                    mapped_id = item_id
                    snippet = extract_item_snippet(item_resources_text, item_id)
                    code_snippet = snippet or build_item_snippet(item_id, 1)
                else:
                    reason = f"Item '{item_id}' not found in Item and Resources.txt"

            # ============================================================
            # 8) ICON PREFIXES: icon_pet_*, icon_daily_boss_*, etc.
            # ============================================================
            elif filename.startswith("icon_") and filename.endswith(".png"):
                item_id = filename.replace(".png", "")
                
                if has_id(item_resources_text, item_id):
                    mapped_id = item_id
                    snippet = extract_item_snippet(item_resources_text, item_id)
                    code_snippet = snippet or build_item_snippet(item_id, 1)
                else:
                    reason = f"Icon '{item_id}' not found in Item and Resources.txt"

            # ============================================================
            # 9) DEFAULT: используем suggested_id из CSV
            # ============================================================
            else:
                if suggested_id and has_id(item_resources_text, suggested_id):
                    mapped_id = suggested_id
                    snippet = extract_item_snippet(item_resources_text, suggested_id)
                    code_snippet = snippet or build_item_snippet(suggested_id, 1)
                else:
                    reason = (
                        f"No matching code found for '{suggested_id or filename}' "
                        f"in Item and Resources.txt"
                    )

            # Сохраняем результат
            results.append({
                "filename": filename,
                "category": category,
                "suggested_id": suggested_id,
                "display_name": display_name,
                "mapped_id": mapped_id,
                "codeSnippet": code_snippet,
                "reason": reason
            })

    return results


def main():
    """Основная функция"""
    print("="*80)
    print("АВТОГЕНЕРАЦИЯ JSON-КОДОВ ДЛЯ ORPHANED ИКОНОК")
    print("="*80)
    
    # Проверяем наличие файлов
    if not ITEM_RESOURCES_PATH.exists():
        raise SystemExit(f"❌ Файл не найден: {ITEM_RESOURCES_PATH}")
    
    if not ORPHANED_CSV_PATH.exists():
        raise SystemExit(f"❌ Файл не найден: {ORPHANED_CSV_PATH}")
    
    print(f"\n✓ Читаем {ITEM_RESOURCES_PATH}")
    item_resources_text = load_item_resources(ITEM_RESOURCES_PATH)
    print(f"  Размер файла: {len(item_resources_text)} символов")
    
    print(f"\n✓ Обрабатываем {ORPHANED_CSV_PATH}")
    results = process_orphaned_icons(item_resources_text, ORPHANED_CSV_PATH)
    
    # Сохраняем результаты
    print(f"\n✓ Сохраняем результаты в {OUTPUT_JSON}")
    with OUTPUT_JSON.open("w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    # Статистика
    print("\n" + "="*80)
    print("СТАТИСТИКА")
    print("="*80)
    
    mapped = sum(1 for r in results if r["mapped_id"] is not None)
    unmapped = len(results) - mapped
    
    print(f"  Всего иконок обработано:     {len(results)}")
    print(f"  ✓ Найдены коды:              {mapped}")
    print(f"  ✗ Коды не найдены:           {unmapped}")
    
    # Разбивка unmapped по категориям
    if unmapped > 0:
        print("\n  Категории без кодов:")
        unmapped_by_category = {}
        for r in results:
            if r["mapped_id"] is None:
                cat = r["category"] or "Unknown"
                unmapped_by_category[cat] = unmapped_by_category.get(cat, 0) + 1
        
        for cat, count in sorted(unmapped_by_category.items(), key=lambda x: -x[1]):
            print(f"    • {cat:.<35} {count:>3} файлов")
    
    print("\n" + "="*80)
    print(f"✅ ГОТОВО! Результаты сохранены в: {OUTPUT_JSON}")
    print("="*80)


if __name__ == "__main__":
    main()
