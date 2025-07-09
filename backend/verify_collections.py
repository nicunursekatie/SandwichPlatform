#!/usr/bin/env python3
"""
Parse the full sandwich log RTF file and compare against database for verification
"""

import re
import psycopg2
import os
from datetime import datetime
from collections import defaultdict

def parse_rtf_log(filename):
    """Parse the RTF file to extract collection data"""
    with open(filename, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    collections = []
    
    # Extract all week patterns directly
    week_patterns = re.findall(r'Week\s+(\d+)\s*\((\d{2}\/\d{2}\/\d{4})\):\s*([\d,]+)\s*sandwiches', content)
    
    # Extract host sections to map weeks to hosts
    host_sections = re.split(r'\\fs36.*?\\cf0', content)[1:]  # Split by host headers
    
    current_host = "Unknown"
    
    for section in host_sections:
        # Try to extract host name from section
        host_match = re.search(r'([A-Z][A-Z\s\(\),&\/\-]+?)\\\\', section)
        if host_match:
            current_host = host_match.group(1).strip()
            # Clean up common RTF artifacts
            current_host = re.sub(r'\\[a-z]+\d*\s*', '', current_host).strip()
        
        # Find week entries in this section
        section_weeks = re.findall(r'Week\s+(\d+)\s*\((\d{2}\/\d{2}\/\d{4})\):\s*([\d,]+)\s*sandwiches', section)
        
        for week_num, date_str, count in section_weeks:
            try:
                date_obj = datetime.strptime(date_str, '%m/%d/%Y')
                iso_date = date_obj.strftime('%Y-%m-%d')
                
                collections.append({
                    'host': current_host,
                    'week': int(week_num),
                    'date': iso_date,
                    'count': int(count.replace(',', '')),
                    'original_date': date_str
                })
            except ValueError:
                print(f"Could not parse date: {date_str}")
    
    # Fallback: if no host mapping worked, just use all patterns with generic host
    if not collections and week_patterns:
        print("Using fallback parsing...")
        for week_num, date_str, count in week_patterns:
            try:
                date_obj = datetime.strptime(date_str, '%m/%d/%Y')
                iso_date = date_obj.strftime('%Y-%m-%d')
                
                collections.append({
                    'host': 'Parsed Entry',
                    'week': int(week_num),
                    'date': iso_date,
                    'count': int(count.replace(',', '')),
                    'original_date': date_str
                })
            except ValueError:
                continue
    
    return collections

def get_database_collections():
    """Get all collections from database"""
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            collection_date,
            host_name,
            individual_sandwiches + CASE 
                WHEN group_collections IS NOT NULL AND group_collections != '' AND group_collections != '[]' 
                THEN (
                    SELECT COALESCE(SUM((value->>'sandwichCount')::int), 0)
                    FROM json_array_elements(group_collections::json) as value
                    WHERE value->>'sandwichCount' IS NOT NULL AND value->>'sandwichCount' ~ '^[0-9]+$'
                )
                ELSE 0
            END as total_sandwiches
        FROM sandwich_collections
        WHERE host_name NOT LIKE '%Reconciliation%'
        AND host_name NOT LIKE '%Alignment%'
        ORDER BY collection_date, host_name
    """)
    
    db_collections = {}
    for row in cursor.fetchall():
        date, host, count = row
        key = f"{date}_{host}"
        db_collections[key] = count
    
    cursor.close()
    conn.close()
    
    return db_collections

def verify_collections():
    """Compare RTF log against database"""
    print("Parsing RTF log file...")
    rtf_collections = parse_rtf_log('attached_assets/full sandwich log_1749878586531.rtf')
    
    print("Getting database collections...")
    db_collections = get_database_collections()
    
    print(f"RTF file contains {len(rtf_collections)} collection entries")
    print(f"Database contains {len(db_collections)} collection entries")
    
    # Group RTF collections by date for comparison
    rtf_by_date = defaultdict(int)
    rtf_by_host = defaultdict(int)
    
    for collection in rtf_collections:
        rtf_by_date[collection['date']] += collection['count']
        rtf_by_host[collection['host']] += collection['count']
    
    # Group database collections by date
    db_by_date = defaultdict(int)
    for key, count in db_collections.items():
        date = key.split('_')[0]
        db_by_date[date] += count
    
    print("\n" + "="*60)
    print("VERIFICATION RESULTS")
    print("="*60)
    
    # Find missing dates
    rtf_dates = set(rtf_by_date.keys())
    db_dates = set(db_by_date.keys())
    
    missing_in_db = rtf_dates - db_dates
    extra_in_db = db_dates - rtf_dates
    
    if missing_in_db:
        print(f"\nDates in RTF but missing from database ({len(missing_in_db)}):")
        for date in sorted(missing_in_db)[:10]:  # Show first 10
            print(f"  {date}: {rtf_by_date[date]:,} sandwiches")
    
    if extra_in_db:
        print(f"\nDates in database but not in RTF ({len(extra_in_db)}):")
        for date in sorted(extra_in_db)[:10]:  # Show first 10
            print(f"  {date}: {db_by_date[date]:,} sandwiches")
    
    # Compare totals for matching dates
    print(f"\nDate-by-date comparison (showing largest discrepancies):")
    discrepancies = []
    
    for date in rtf_dates & db_dates:
        rtf_total = rtf_by_date[date]
        db_total = db_by_date[date]
        diff = db_total - rtf_total
        if abs(diff) > 10:  # Only show significant differences
            discrepancies.append((date, rtf_total, db_total, diff))
    
    discrepancies.sort(key=lambda x: abs(x[3]), reverse=True)
    
    for date, rtf_total, db_total, diff in discrepancies[:15]:
        status = "DB Higher" if diff > 0 else "RTF Higher"
        print(f"  {date}: RTF={rtf_total:,}, DB={db_total:,}, Diff={diff:+,} ({status})")
    
    # Summary totals
    rtf_grand_total = sum(rtf_by_date.values())
    db_grand_total = sum(db_by_date.values())
    
    print(f"\nGRAND TOTALS:")
    print(f"  RTF Log Total: {rtf_grand_total:,} sandwiches")
    print(f"  Database Total: {db_grand_total:,} sandwiches")
    print(f"  Difference: {db_grand_total - rtf_grand_total:+,} sandwiches")
    
    print(f"\nHost breakdown from RTF (top 10):")
    sorted_hosts = sorted(rtf_by_host.items(), key=lambda x: x[1], reverse=True)
    for host, total in sorted_hosts[:10]:
        print(f"  {host}: {total:,} sandwiches")

if __name__ == "__main__":
    verify_collections()