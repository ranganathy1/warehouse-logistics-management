import psycopg2 
from dotenv import load_dotenv
import os

load_dotenv()

DB_URL = os.getenv("DB_URL")

def get_connection():
    conn = psycopg2.connect(DB_URL)
    return conn

if __name__ == "__main__":
    try:
        print("Attempting to connect to the database...")
        connection = get_connection()
        print("✅ Success! Connection established smoothly.")
        connection.close()
    except Exception as e:
        print("❌ Connection failed!")
        print(f"Error details: {e}")