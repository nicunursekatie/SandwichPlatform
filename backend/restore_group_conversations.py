#!/usr/bin/env python3
"""
Restore group conversations and their members from backup files
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

def load_group_backup():
    """Load group threads backup"""
    try:
        with open('group_threads_backup_20250706.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print("❌ Group threads backup file not found")
        return None

def load_conversation_backup():
    """Load conversation threads backup"""
    try:
        with open('conversation_threads_backup_20250706.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print("❌ Conversation threads backup file not found")
        return None

def restore_group_conversations():
    """Restore group conversations from backup"""
    conn = connect_to_db()
    cursor = conn.cursor()
    
    # Load backup data
    group_backup = load_group_backup()
    conversation_backup = load_conversation_backup()
    
    if not group_backup and not conversation_backup:
        print("❌ No backup files found")
        return
    
    restored_groups = 0
    
    # Get existing group conversations
    cursor.execute("SELECT name FROM conversations WHERE type = 'group'")
    existing_groups = {row[0] for row in cursor.fetchall()}
    
    # Restore from group threads backup if available
    if group_backup and 'groups' in group_backup:
        print(f"📁 Found {len(group_backup['groups'])} groups in backup")
        
        for group in group_backup['groups']:
            group_name = group.get('name', 'Unknown Group')
            
            if group_name in existing_groups:
                print(f"⏭️  Group '{group_name}' already exists")
                continue
            
            try:
                # Insert group conversation
                cursor.execute("""
                    INSERT INTO conversations (type, name, created_at)
                    VALUES ('group', %s, %s)
                    RETURNING id
                """, (group_name, group.get('created_at', 'NOW()')))
                
                conversation_id = cursor.fetchone()[0]
                print(f"✅ Created group conversation '{group_name}' with ID {conversation_id}")
                
                # Add members if available
                members = group.get('members', [])
                for member in members:
                    user_id = member.get('user_id')
                    if user_id:
                        try:
                            cursor.execute("""
                                INSERT INTO conversation_participants (conversation_id, user_id, joined_at)
                                VALUES (%s, %s, NOW())
                            """, (conversation_id, user_id))
                            print(f"  ➕ Added member {user_id}")
                        except Exception as e:
                            print(f"  ❌ Failed to add member {user_id}: {e}")
                
                restored_groups += 1
                
            except Exception as e:
                print(f"❌ Failed to restore group '{group_name}': {e}")
                continue
    
    # Also check conversation backup for any group-type conversations
    if conversation_backup and 'conversations' in conversation_backup:
        print(f"📁 Checking {len(conversation_backup['conversations'])} conversations from backup")
        
        for conv in conversation_backup['conversations']:
            if conv.get('type') == 'group':
                conv_name = conv.get('name', 'Unknown Group')
                
                if conv_name in existing_groups:
                    continue
                
                try:
                    cursor.execute("""
                        INSERT INTO conversations (type, name, created_at)
                        VALUES ('group', %s, %s)
                        RETURNING id
                    """, (conv_name, conv.get('created_at', 'NOW()')))
                    
                    conversation_id = cursor.fetchone()[0]
                    print(f"✅ Created group conversation '{conv_name}' from conversation backup")
                    restored_groups += 1
                    
                except Exception as e:
                    print(f"❌ Failed to restore group '{conv_name}': {e}")
                    continue
    
    # Commit all changes
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"\n🎉 Group restoration complete!")
    print(f"📊 Restored {restored_groups} group conversations")

if __name__ == "__main__":
    restore_group_conversations()