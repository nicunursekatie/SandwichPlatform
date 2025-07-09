#!/usr/bin/env python3
"""
Import missing group donations from CSV file into the sandwich collection system.
These donations don't have specific host locations, so we'll use a special "Groups" host.
"""

import os
import csv
import psycopg2
from datetime import datetime

def connect_to_db():
    """Connect to PostgreSQL database"""
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        return conn
    except Exception as e:
        print(f"Database connection failed: {e}")
        return None

def create_groups_host(conn):
    """Create a special 'Groups' host for group donations without specific locations"""
    cursor = conn.cursor()
    
    # Check if Groups host already exists
    cursor.execute("SELECT id FROM hosts WHERE name = %s", ("Groups",))
    if cursor.fetchone():
        print("✓ Groups host already exists")
        cursor.close()
        return
    
    # Create the Groups host
    cursor.execute("""
        INSERT INTO hosts (name, phone, email, address, status, notes)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (
        "Groups",
        "N/A",
        "groups@sandwich.project",
        "Multiple Locations",
        "active",
        "Special host for group donations that don't have a specific host location. These are collective donations from various groups."
    ))
    
    conn.commit()
    cursor.close()
    print("✓ Created Groups host for group donations")

def import_group_donations(conn):
    """Import group donations from CSV file"""
    cursor = conn.cursor()
    
    csv_file = "attached_assets/missing sandwiches groups_1751499960217.csv"
    
    if not os.path.exists(csv_file):
        print(f"❌ CSV file not found: {csv_file}")
        return
    
    imported_count = 0
    total_sandwiches = 0
    
    with open(csv_file, 'r', encoding='utf-8') as file:
        csv_reader = csv.DictReader(file)
        
        for row in csv_reader:
            collection_date = row['Collection Date'].strip()
            host_name = "Groups"  # Use our special Groups host
            individual_sandwiches = int(row['Individual Sandwiches'])
            notes = row['Notes'].strip()
            
            # Check if this exact record already exists to avoid duplicates
            cursor.execute("""
                SELECT id FROM sandwich_collections 
                WHERE collection_date = %s 
                AND host_name = %s 
                AND individual_sandwiches = %s
            """, (collection_date, host_name, individual_sandwiches))
            
            if cursor.fetchone():
                print(f"⚠️  Skipping duplicate: {collection_date} - {individual_sandwiches} sandwiches")
                continue
            
            # Insert the collection record
            cursor.execute("""
                INSERT INTO sandwich_collections (
                    collection_date, 
                    host_name, 
                    individual_sandwiches, 
                    group_collections,
                    submitted_at
                ) VALUES (%s, %s, %s, %s, %s)
            """, (
                collection_date,
                host_name,
                individual_sandwiches,
                '[]',  # Empty group collections since this IS the group collection
                datetime.now()
            ))
            
            imported_count += 1
            total_sandwiches += individual_sandwiches
            print(f"✓ Imported: {collection_date} - {individual_sandwiches:,} sandwiches")
    
    conn.commit()
    cursor.close()
    
    print(f"\n📊 Import Summary:")
    print(f"   Records imported: {imported_count}")
    print(f"   Total sandwiches: {total_sandwiches:,}")
    
    return imported_count, total_sandwiches

def verify_totals_after_import(conn):
    """Verify the database totals after import"""
    cursor = conn.cursor()
    
    # Get total collections and sandwiches
    cursor.execute("""
        SELECT COUNT(*) as total_entries, 
               COALESCE(SUM(individual_sandwiches), 0) as total_sandwiches
        FROM sandwich_collections
    """)
    
    result = cursor.fetchone()
    total_entries, total_sandwiches = result
    
    # Get Groups-specific totals
    cursor.execute("""
        SELECT COUNT(*) as group_entries, 
               COALESCE(SUM(individual_sandwiches), 0) as group_sandwiches
        FROM sandwich_collections
        WHERE host_name = 'Groups'
    """)
    
    result = cursor.fetchone()
    group_entries, group_sandwiches = result
    
    cursor.close()
    
    print(f"\n🔍 Database Totals After Import:")
    print(f"   Total entries: {total_entries:,}")
    print(f"   Total sandwiches: {total_sandwiches:,}")
    print(f"   Groups entries: {group_entries}")
    print(f"   Groups sandwiches: {group_sandwiches:,}")

def main():
    print("🥪 Importing Group Donations into Sandwich Collection System")
    print("=" * 60)
    
    conn = connect_to_db()
    if not conn:
        return
    
    try:
        # Step 1: Create Groups host
        create_groups_host(conn)
        
        # Step 2: Import the CSV data
        imported_count, total_sandwiches = import_group_donations(conn)
        
        # Step 3: Verify totals
        verify_totals_after_import(conn)
        
        print(f"\n✅ Successfully imported {imported_count} group donation records")
        print(f"   Added {total_sandwiches:,} sandwiches to your collection totals!")
        
    except Exception as e:
        print(f"❌ Import failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    main()