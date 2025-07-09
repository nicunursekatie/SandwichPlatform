#!/usr/bin/env python3
"""
Comprehensive parser to extract all 1,278 entries from the RTF log
"""

import re
import psycopg2
import os
from datetime import datetime
from collections import defaultdict

def parse_complete_rtf_log(filename):
    """Parse the complete RTF file to extract weekly totals (not individual locations)"""
    with open(filename, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    # Dictionary to aggregate by week
    weekly_totals = defaultdict(lambda: {'count': 0, 'date': '', 'locations': []})
    
    # Pattern to catch all week entries with dates and counts
    week_pattern = r'Week\s+(\d+)\s*\([^\)]*(\d{1,2}\/\d{1,2}\/\d{4})[^\)]*\):\s*([0-9,]+)\s*sandwiches'
    matches = re.findall(week_pattern, content, re.IGNORECASE)
    
    print(f"Found {len(matches)} individual location entries")
    
    for week_num, date_str, count_str in matches:
        try:
            week_num = int(week_num)
            count = int(count_str.replace(',', ''))
            
            # Handle malformed dates (0/ instead of 10/)
            if date_str.startswith('0/'):
                date_str = '10/' + date_str[2:]
            
            # Parse date
            try:
                date_obj = datetime.strptime(date_str, '%m/%d/%Y')
                iso_date = date_obj.strftime('%Y-%m-%d')
            except ValueError:
                # Skip entries with unparseable dates
                continue
            
            # Aggregate by week number
            if not weekly_totals[week_num]['date']:
                weekly_totals[week_num]['date'] = iso_date
                weekly_totals[week_num]['original_date'] = date_str
            
            weekly_totals[week_num]['count'] += count
            weekly_totals[week_num]['locations'].append(count)
            
        except (ValueError, IndexError) as e:
            print(f"Could not parse: Week {week_num}, {date_str}, {count_str} - {e}")
    
    # Convert to list format
    collections = []
    for week_num, data in weekly_totals.items():
        collections.append({
            'week': week_num,
            'date': data['date'],
            'count': data['count'],
            'original_date': data['original_date'],
            'location_count': len(data['locations'])
        })
    
    return collections

def analyze_rtf_totals():
    """Analyze the complete RTF log"""
    print("Parsing complete RTF log...")
    collections = parse_complete_rtf_log('attached_assets/full sandwich log_1749878586531.rtf')
    
    print(f"\nParsed {len(collections)} collection entries")
    
    if collections:
        # Calculate total
        total_sandwiches = sum(c['count'] for c in collections)
        print(f"Total sandwiches from RTF: {total_sandwiches:,}")
        
        # Show date range
        dates = [c['date'] for c in collections]
        print(f"Date range: {min(dates)} to {max(dates)}")
        
        # Show some sample entries
        print(f"\nSample entries:")
        sorted_collections = sorted(collections, key=lambda x: x['date'])
        for i, c in enumerate(sorted_collections[:10]):
            print(f"{i+1:2d}. Week {c['week']:3d} ({c['original_date']}): {c['count']:,} sandwiches")
        
        print("...")
        for i, c in enumerate(sorted_collections[-10:], len(sorted_collections)-9):
            print(f"{i:2d}. Week {c['week']:3d} ({c['original_date']}): {c['count']:,} sandwiches")
        
        # Show highest counts
        print(f"\nHighest collection weeks:")
        highest = sorted(collections, key=lambda x: x['count'], reverse=True)
        for i, c in enumerate(highest[:10]):
            print(f"{i+1:2d}. Week {c['week']:3d} ({c['original_date']}): {c['count']:,} sandwiches")
    
    return collections

if __name__ == "__main__":
    analyze_rtf_totals()