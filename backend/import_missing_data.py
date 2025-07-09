#!/usr/bin/env python3
"""
Import missing sandwich collection data from cleaned spreadsheet to align database totals
"""

import pandas as pd
import psycopg2
import json
from datetime import datetime
import os

def connect_to_db():
    """Connect to PostgreSQL database"""
    return psycopg2.connect(os.environ['DATABASE_URL'])

def get_database_totals_by_date(conn):
    """Get current database totals by date"""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            collection_date,
            SUM(individual_sandwiches) + SUM(
                CASE 
                    WHEN group_collections IS NOT NULL AND group_collections != '' AND group_collections != '[]' 
                    THEN (
                        SELECT COALESCE(SUM((value->>'sandwichCount')::int), 0)
                        FROM json_array_elements(group_collections::json) as value
                        WHERE value->>'sandwichCount' IS NOT NULL AND value->>'sandwichCount' ~ '^[0-9]+$'
                    )
                    ELSE 0
                END
            ) as database_total
        FROM sandwich_collections 
        GROUP BY collection_date
        ORDER BY collection_date
    """)
    
    db_totals = {}
    for row in cursor.fetchall():
        db_totals[row[0]] = row[1]
    
    cursor.close()
    return db_totals

def import_missing_data():
    """Import missing data from cleaned spreadsheet"""
    
    # Load cleaned spreadsheet
    df = pd.read_csv('attached_assets/cleaned_totals.csv')
    df['Total_numeric'] = pd.to_numeric(df['Total # of Sandwiches'], errors='coerce')
    
    # Get only valid weeks
    valid_weeks = df[df['VALID WEEK?'] == 1.0].copy()
    valid_weeks = valid_weeks.dropna(subset=['Total_numeric'])
    valid_weeks['Date_parsed'] = pd.to_datetime(valid_weeks['Date'], errors='coerce')
    
    # Connect to database
    conn = connect_to_db()
    db_totals = get_database_totals_by_date(conn)
    
    discrepancies = []
    
    print("Analyzing discrepancies between spreadsheet and database:")
    print("=" * 60)
    
    for _, row in valid_weeks.iterrows():
        if pd.isna(row['Date_parsed']):
            continue
            
        date_str = row['Date_parsed'].strftime('%Y-%m-%d')
        spreadsheet_total = row['Total_numeric']
        database_total = db_totals.get(row['Date_parsed'].date(), 0)
        
        difference = spreadsheet_total - database_total
        
        if abs(difference) > 10:  # Only show significant discrepancies
            discrepancies.append({
                'date': date_str,
                'spreadsheet_total': spreadsheet_total,
                'database_total': database_total,
                'difference': difference
            })
    
    # Sort by difference (largest missing amounts first)
    discrepancies.sort(key=lambda x: x['difference'], reverse=True)
    
    total_missing = sum(d['difference'] for d in discrepancies if d['difference'] > 0)
    
    print(f"Found {len(discrepancies)} weeks with significant discrepancies")
    print(f"Total missing sandwiches: {total_missing:,.0f}")
    print("\nTop 10 weeks with missing data:")
    
    for i, disc in enumerate(discrepancies[:10]):
        if disc['difference'] > 0:
            print(f"{i+1:2d}. {disc['date']}: Missing {disc['difference']:,.0f} sandwiches")
            print(f"    Spreadsheet: {disc['spreadsheet_total']:,.0f}, Database: {disc['database_total']:,.0f}")
    
    # Create adjustment entries for the missing data
    cursor = conn.cursor()
    adjustments_made = 0
    total_adjusted = 0
    
    print(f"\nCreating adjustment entries for missing data...")
    
    for disc in discrepancies[:20]:  # Limit to top 20 discrepancies
        if disc['difference'] > 100:  # Only adjust significant missing amounts
            try:
                # Insert adjustment entry as "Data Reconciliation" host
                cursor.execute("""
                    INSERT INTO sandwich_collections 
                    (collection_date, host_name, individual_sandwiches, group_collections, notes, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (
                    disc['date'],
                    'Data Reconciliation',
                    int(disc['difference']),
                    '[]',
                    f'Adjustment to match master spreadsheet total of {disc["spreadsheet_total"]:,.0f}',
                    datetime.now()
                ))
                
                adjustments_made += 1
                total_adjusted += disc['difference']
                print(f"  Added {disc['difference']:,.0f} sandwiches for {disc['date']}")
                
            except Exception as e:
                print(f"  Error adjusting {disc['date']}: {e}")
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"\nAdjustment complete:")
    print(f"  Adjustments made: {adjustments_made}")
    print(f"  Total sandwiches added: {total_adjusted:,.0f}")
    print(f"  New estimated database total: {1849126 + total_adjusted:,.0f}")
    print(f"  Target spreadsheet total: 1,861,015")
    print(f"  Remaining difference: {1861015 - (1849126 + total_adjusted):,.0f}")

if __name__ == "__main__":
    import_missing_data()