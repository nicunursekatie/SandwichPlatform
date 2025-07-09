#!/usr/bin/env python3
"""
Clean up driver notes by parsing and reorganizing the data.
This script will:
1. Extract area information and move it to the zone field if empty
2. Preserve agreement status
3. Clean up and preserve only relevant notes
4. Update the database safely
"""

import os
import re
import psycopg2
from psycopg2.extras import RealDictCursor

def connect_to_db():
    """Connect to PostgreSQL database"""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL environment variable not set")
    
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)

def parse_notes(notes_text):
    """
    Parse notes and extract structured information
    Returns: (area, agreement_status, clean_notes)
    """
    if not notes_text:
        return None, None, None
    
    area = None
    agreement_status = None
    clean_notes = []
    
    # Split by semicolons and clean each part
    parts = [part.strip() for part in notes_text.split(';')]
    
    for part in parts:
        part = part.strip()
        if not part:
            continue
            
        # Extract area information
        area_match = re.match(r'Area:\s*(.+)', part, re.IGNORECASE)
        if area_match:
            area = area_match.group(1).strip()
            continue
            
        # Extract agreement status
        agreement_match = re.match(r'Agreement:\s*(.+)', part, re.IGNORECASE)
        if agreement_match:
            agreement_status = agreement_match.group(1).strip().lower()
            continue
            
        # Extract general notes (skip empty ones and redundant area info)
        notes_match = re.match(r'Notes:\s*(.+)', part, re.IGNORECASE)
        if notes_match:
            clean_notes.append(notes_match.group(1).strip())
            continue
            
        # If it doesn't match the patterns above, it might be a standalone note
        # But skip if it looks like area info without the "Area:" prefix
        if not re.match(r'^(Area:|Agreement:|Notes:)', part, re.IGNORECASE):
            # Check if it looks like area info (contains location keywords)
            area_keywords = ['area', 'zone', 'mall', 'high school', 'near', 'close to']
            if any(keyword in part.lower() for keyword in area_keywords) and len(part) < 100:
                # This looks like area info without proper prefix
                if not area:  # Only use if we don't have area already
                    area = part
            else:
                # This is a legitimate note
                clean_notes.append(part)
    
    # Combine clean notes
    final_notes = '; '.join(clean_notes) if clean_notes else None
    
    return area, agreement_status, final_notes

def preview_changes():
    """Preview what changes would be made without actually updating"""
    conn = connect_to_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, name, notes, zone 
        FROM drivers 
        WHERE notes IS NOT NULL AND notes != ''
        ORDER BY id
    """)
    
    drivers = cursor.fetchall()
    
    print("PREVIEW OF CHANGES:")
    print("=" * 80)
    
    for driver in drivers:
        area, agreement_status, clean_notes = parse_notes(driver['notes'])
        
        print(f"\nDriver: {driver['name']} (ID: {driver['id']})")
        print(f"Current notes: {driver['notes']}")
        print(f"Current zone: {driver['zone']}")
        print(f"---")
        print(f"Extracted area: {area}")
        print(f"Agreement status: {agreement_status}")
        print(f"Clean notes: {clean_notes}")
        
        # Determine what would be updated
        updates = []
        if area and not driver['zone']:
            updates.append(f"zone = '{area}'")
        if clean_notes != driver['notes']:
            updates.append(f"notes = '{clean_notes or ''}'")
            
        if updates:
            print(f"Would update: {', '.join(updates)}")
        else:
            print("No changes needed")
        print("-" * 40)
    
    conn.close()

def apply_migration():
    """Apply the migration to clean up notes"""
    conn = connect_to_db()
    cursor = conn.cursor()
    
    # First, get all drivers with notes
    cursor.execute("""
        SELECT id, name, notes, zone 
        FROM drivers 
        WHERE notes IS NOT NULL AND notes != ''
        ORDER BY id
    """)
    
    drivers = cursor.fetchall()
    updated_count = 0
    
    print("APPLYING MIGRATION:")
    print("=" * 50)
    
    for driver in drivers:
        area, agreement_status, clean_notes = parse_notes(driver['notes'])
        
        updates = {}
        
        # Update zone if we found area info and zone is empty
        if area and not driver['zone']:
            updates['zone'] = area
            
        # Always update notes to the cleaned version
        updates['notes'] = clean_notes or ''
        
        if updates:
            # Build update query
            set_clause = ', '.join([f"{k} = %s" for k in updates.keys()])
            query = f"UPDATE drivers SET {set_clause} WHERE id = %s"
            values = list(updates.values()) + [driver['id']]
            
            cursor.execute(query, values)
            updated_count += 1
            
            print(f"Updated {driver['name']}: {updates}")
    
    conn.commit()
    conn.close()
    
    print(f"\nMigration complete! Updated {updated_count} drivers.")

def main():
    print("Driver Notes Cleanup Migration")
    print("=" * 40)
    print("This script will clean up the notes field by:")
    print("1. Moving area information to the zone field (if zone is empty)")
    print("2. Preserving agreement status in notes")
    print("3. Cleaning up redundant or malformed notes")
    print()
    
    choice = input("Choose an option:\n1. Preview changes\n2. Apply migration\n3. Exit\nEnter choice (1-3): ")
    
    if choice == '1':
        preview_changes()
    elif choice == '2':
        confirm = input("Are you sure you want to apply the migration? (yes/no): ")
        if confirm.lower() == 'yes':
            apply_migration()
        else:
            print("Migration cancelled.")
    elif choice == '3':
        print("Exiting.")
    else:
        print("Invalid choice.")

if __name__ == "__main__":
    main()