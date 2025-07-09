"""
Import pre-location sandwich logs from Excel file and assign to "OG Sandwich Project"
"""
import pandas as pd
import psycopg2
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

def connect_to_db():
    """Connect to PostgreSQL database"""
    try:
        conn = psycopg2.connect(os.getenv('DATABASE_URL'))
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

def examine_excel_structure(file_path):
    """Examine the structure of the Excel file"""
    try:
        # Read Excel file to understand its structure
        excel_file = pd.ExcelFile(file_path)
        print(f"Sheet names: {excel_file.sheet_names}")
        
        # Examine each sheet
        for sheet_name in excel_file.sheet_names:
            print(f"\n--- Sheet: {sheet_name} ---")
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            print(f"Shape: {df.shape}")
            print(f"Columns: {df.columns.tolist()}")
            print(f"First 5 rows:")
            print(df.head())
            print(f"Data types:")
            print(df.dtypes)
            
        return excel_file.sheet_names
    except Exception as e:
        print(f"Error examining Excel file: {e}")
        return []

def import_pre_location_logs(file_path):
    """Import pre-location logs to database with 'OG Sandwich Project' as host"""
    conn = connect_to_db()
    if not conn:
        return False
    
    try:
        cursor = conn.cursor()
        
        # First examine the file structure
        sheet_names = examine_excel_structure(file_path)
        
        # Process the main sheet (assuming first sheet contains the data)
        df = pd.read_excel(file_path, sheet_name=0)
        
        # Clean and prepare data
        imported_count = 0
        skipped_count = 0
        
        for index, row in df.iterrows():
            try:
                collection_date = None
                sandwich_count = 0
                
                # Extract date from 'Date' column
                if 'Date' in df.columns and pd.notna(row['Date']):
                    date_value = row['Date']
                    if isinstance(date_value, str):
                        try:
                            # Handle string dates
                            collection_date = datetime.strptime(date_value, '%Y-%m-%d %H:%M:%S').date()
                        except:
                            try:
                                collection_date = datetime.strptime(date_value, '%Y-%m-%d').date()
                            except:
                                try:
                                    collection_date = datetime.strptime(date_value, '%m/%d/%Y').date()
                                except:
                                    pass
                    elif hasattr(date_value, 'date'):
                        # Handle datetime objects
                        collection_date = date_value.date()
                    elif isinstance(date_value, pd.Timestamp):
                        collection_date = date_value.date()
                
                # Extract sandwich count from 'Total # of Sandwiches' column
                if 'Total # of Sandwiches' in df.columns and pd.notna(row['Total # of Sandwiches']):
                    try:
                        sandwich_count = int(float(row['Total # of Sandwiches']))
                    except:
                        pass
                
                if collection_date and sandwich_count > 0:
                    # Insert into sandwich_collections table using actual schema
                    insert_query = """
                        INSERT INTO sandwich_collections 
                        (host_name, collection_date, individual_sandwiches, group_collections, submitted_at)
                        VALUES (%s, %s, %s, %s, %s)
                    """
                    
                    current_time = datetime.now()
                    group_collections_json = "[]"  # Empty array since these are pre-location logs
                    
                    cursor.execute(insert_query, (
                        "OG Sandwich Project",
                        collection_date.strftime('%Y-%m-%d'),
                        sandwich_count,
                        group_collections_json,
                        current_time
                    ))
                    
                    imported_count += 1
                    print(f"Imported: {collection_date} - {sandwich_count} sandwiches")
                else:
                    skipped_count += 1
                    print(f"Skipped row {index}: missing date or count")
                    
            except Exception as row_error:
                print(f"Error processing row {index}: {row_error}")
                skipped_count += 1
                continue
        
        conn.commit()
        print(f"\nImport completed:")
        print(f"Successfully imported: {imported_count} records")
        print(f"Skipped: {skipped_count} records")
        
        return True
        
    except Exception as e:
        print(f"Import error: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            cursor.close()
            conn.close()

def main():
    file_path = "attached_assets/Pre-Location Logs_1749909341284.xlsx"
    
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return
    
    print("Starting import of pre-location sandwich logs...")
    success = import_pre_location_logs(file_path)
    
    if success:
        print("Import completed successfully!")
    else:
        print("Import failed. Please check the error messages above.")

if __name__ == "__main__":
    main()