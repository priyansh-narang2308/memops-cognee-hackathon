import sys

def main():
    if len(sys.argv) < 2:
        print("Error: Missing service name argument")
        sys.exit(1)
    service_name = sys.argv[1]
    print(f"Stopping service: {service_name}")
    print(f"Starting service: {service_name}")
    print(f"Service {service_name} restarted successfully")

if __name__ == "__main__":
    main()
