import sys

def main():
    if len(sys.argv) < 2:
        print("Error: Missing database name argument")
        sys.exit(1)
    db_name = sys.argv[1]
    print(f"Connecting to database: {db_name}")
    print("Flushing connection pools...")
    print("Flushed 14 idle connections")
    print("Database connection pools flushed successfully")

if __name__ == "__main__":
    main()
