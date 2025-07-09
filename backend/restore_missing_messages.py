#!/usr/bin/env python3
"""
Restore missing messages from backup after the messaging system rebuild
"""

import json
import psycopg2
import os
from datetime import datetime

def connect_to_db():
    """Connect to PostgreSQL database"""
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise Exception("DATABASE_URL environment variable not set")
    return psycopg2.connect(database_url)

def load_backup_data():
    """Load the backed up messages"""
    with open('messages_backup_20250706.json', 'r') as f:
        return json.load(f)

def get_current_messages(conn):
    """Get current messages in database"""
    cursor = conn.cursor()
    cursor.execute("SELECT content, created_at FROM messages ORDER BY id")
    return [{'content': row[0], 'created_at': str(row[1])} for row in cursor.fetchall()]

def restore_missing_messages():
    """Restore missing messages from backup"""
    conn = connect_to_db()
    cursor = conn.cursor()
    
    # Load backup data
    backup_data = load_backup_data()
    backup_messages = backup_data['messages']
    
    print(f"📁 Found {len(backup_messages)} messages in backup")
    
    # Get current messages
    current_messages = get_current_messages(conn)
    print(f"💾 Found {len(current_messages)} messages currently in database")
    
    # Get existing conversation for Core Team (channel conversations)
    cursor.execute("""
        SELECT id FROM conversations 
        WHERE type = 'channel' AND name = 'Core Team'
        LIMIT 1
    """)
    core_team_conv = cursor.fetchone()
    
    if not core_team_conv:
        # Create Core Team conversation
        cursor.execute("""
            INSERT INTO conversations (type, name, created_at)
            VALUES ('channel', 'Core Team', NOW())
            RETURNING id
        """)
        core_team_conv_id = cursor.fetchone()[0]
        print(f"✅ Created Core Team conversation with ID {core_team_conv_id}")
    else:
        core_team_conv_id = core_team_conv[0]
        print(f"✅ Using existing Core Team conversation with ID {core_team_conv_id}")
    
    # Map backup messages to appropriate conversations
    restored_count = 0
    
    for msg in backup_messages:
        content = msg['content']
        timestamp = msg['timestamp']
        sender = msg.get('sender', 'Unknown')
        chat_type = msg.get('chat_type', 'general')
        
        # Check if this message content already exists
        existing = any(cm['content'] == content for cm in current_messages)
        if existing:
            print(f"⏭️  Skipping duplicate message: '{content[:50]}...'")
            continue
        
        # Determine conversation and user ID
        if chat_type in ['general', 'committee']:
            conversation_id = core_team_conv_id
            # Map sender names to user IDs (simplified mapping)
            if sender == 'Katie':
                user_id = 'user_1751071509329_mrkw2z95z'  # Katie's ID
            else:
                user_id = 'user_backup_restored'  # Generic ID for backup messages
        else:
            # Skip other types for now
            continue
        
        try:
            # Insert the message
            cursor.execute("""
                INSERT INTO messages (conversation_id, user_id, content, created_at)
                VALUES (%s, %s, %s, %s)
            """, (conversation_id, user_id, content, timestamp))
            
            restored_count += 1
            print(f"✅ Restored message from {sender}: '{content[:50]}...'")
            
        except Exception as e:
            print(f"❌ Failed to restore message: {e}")
            continue
    
    # Commit all changes
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"\n🎉 Restoration complete!")
    print(f"📊 Restored {restored_count} messages from backup")
    print(f"💬 Total messages now: {len(current_messages) + restored_count}")

if __name__ == "__main__":
    restore_missing_messages()