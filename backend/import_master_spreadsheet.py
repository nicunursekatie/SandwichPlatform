"""
Import missing data from the master spreadsheet to close the gap to 1,868,147 sandwiches
"""
import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

def connect_to_db():
    """Connect to PostgreSQL database"""
    return psycopg2.connect(
        host=os.getenv("PGHOST"),
        database=os.getenv("PGDATABASE"),
        user=os.getenv("PGUSER"),
        password=os.getenv("PGPASSWORD"),
        port=os.getenv("PGPORT")
    )

def get_existing_dates():
    """Get all existing collection dates from database"""
    conn = connect_to_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT DISTINCT collection_date FROM sandwich_collections ORDER BY collection_date;")
    existing_dates = set(row[0].strftime('%Y-%m-%d') for row in cursor.fetchall())
    
    cursor.close()
    conn.close()
    return existing_dates

def import_master_spreadsheet_data():
    """Import missing weekly totals from master spreadsheet"""
    
    file_path = "attached_assets/CLEANED UP Sandwich Totals (3)_1749876826872.xlsx"
    print(f"Loading master spreadsheet: {file_path}")
    
    # Read the spreadsheet
    df = pd.read_excel(file_path, sheet_name=0)
    
    # Clean the data
    df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
    df['Total # of Sandwiches'] = pd.to_numeric(df['Total # of Sandwiches'], errors='coerce')
    
    # Filter valid rows
    valid_data = df[(df['Date'].notna()) & (df['Total # of Sandwiches'].notna()) & (df['Total # of Sandwiches'] > 0)]
    
    print(f"Found {len(valid_data)} valid weekly entries in spreadsheet")
    print(f"Date range: {valid_data['Date'].min()} to {valid_data['Date'].max()}")
    print(f"Total sandwiches: {valid_data['Total # of Sandwiches'].sum():,}")
    
    # Get existing dates from database
    existing_dates = get_existing_dates()
    print(f"Database has {len(existing_dates)} existing collection dates")
    
    # Find missing data
    missing_entries = []
    
    for _, row in valid_data.iterrows():
        date_str = row['Date'].strftime('%Y-%m-%d')
        total_sandwiches = int(row['Total # of Sandwiches'])
        
        # Check if this date already exists in database
        if date_str not in existing_dates:
            missing_entries.append({
                'date': date_str,
                'sandwiches': total_sandwiches,
                'source': 'Master Spreadsheet Weekly Total'
            })
    
    print(f"\nFound {len(missing_entries)} missing weekly entries")
    
    if missing_entries:
        # Import missing entries
        conn = connect_to_db()
        cursor = conn.cursor()
        
        imported_count = 0
        total_imported_sandwiches = 0
        
        for entry in missing_entries:
            try:
                cursor.execute("""
                    INSERT INTO sandwich_collections 
                    (collection_date, host_name, individual_sandwiches, group_collections, notes)
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    entry['date'],
                    'Weekly Total (Master Spreadsheet)',
                    entry['sandwiches'],
                    None,
                    f"Imported from master spreadsheet - {entry['source']}"
                ))
                
                imported_count += 1
                total_imported_sandwiches += entry['sandwiches']
                
                if imported_count % 10 == 0:
                    print(f"Imported {imported_count} entries...")
                    
            except Exception as e:
                print(f"Error importing entry for {entry['date']}: {e}")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"\nIMPORT COMPLETE:")
        print(f"Imported {imported_count} new weekly entries")
        print(f"Added {total_imported_sandwiches:,} sandwiches to database")
    
    # Final verification
    verify_totals()

def verify_totals():
    """Verify current database totals after import"""
    conn = connect_to_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute("""
        SELECT 
            COUNT(*) as total_entries,
            SUM(individual_sandwiches) as total_sandwiches,
            MIN(collection_date) as earliest_date,
            MAX(collection_date) as latest_date
        FROM sandwich_collections;
    """)
    
    stats = cursor.fetchone()
    
    cursor.close()
    conn.close()
    
    target = 1868147
    current = stats['total_sandwiches']
    gap = target - current
    
    print(f"\nFINAL VERIFICATION:")
    print(f"Database entries: {stats['total_entries']:,}")
    print(f"Total sandwiches: {current:,}")
    print(f"Target total: {target:,}")
    print(f"Remaining gap: {gap:,}")
    print(f"Progress: {(current/target)*100:.1f}%")

def main():
    print("Importing missing data from master spreadsheet...")
    import_master_spreadsheet_data()

if __name__ == "__main__":
    main()