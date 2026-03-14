#!/usr/bin/env python3
"""
TaxIQ Pro Backend API Testing Suite
Testing the 5 new premium feature endpoints
"""

import requests
import json
import os
import tempfile
from datetime import datetime
import base64

# Configuration
BASE_URL = "https://quick-revenue-apps.preview.emergentagent.com/api"
HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
}

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'
    BOLD = '\033[1m'

def print_test_header(test_name):
    print(f"\n{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BLUE}{Colors.BOLD}Testing: {test_name}{Colors.END}")
    print(f"{Colors.BLUE}{'='*60}{Colors.END}")

def print_result(test_name, success, details=""):
    status = f"{Colors.GREEN}✅ PASS{Colors.END}" if success else f"{Colors.RED}❌ FAIL{Colors.END}"
    print(f"\n{status} {test_name}")
    if details:
        print(f"   {details}")

def create_test_pdf():
    """Create a simple test PDF file for bank statement testing"""
    pdf_content = b"""%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
  /Font <<
    /F1 <<
      /Type /Font
      /Subtype /Type1
      /BaseFont /Helvetica
    >>
  >>
>>
>>
endobj

4 0 obj
<<
/Length 87
>>
stream
BT
/F1 12 Tf
72 720 Td
(Test Bank Statement) Tj
0 -20 Td
(2025-07-01 Shell Gas $45.67) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000062 00000 n 
0000000119 00000 n 
0000000344 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
481
%%EOF"""
    return pdf_content

def create_test_csv():
    """Create a simple test CSV file for earnings import"""
    csv_content = """Date,Amount,Description
2025-07-01,125.50,Uber Trip #1
2025-07-02,89.75,Uber Trip #2
2025-07-03,67.25,Uber Trip #3
2025-07-04,156.00,Uber Trip #4
2025-07-05,92.80,Uber Trip #5"""
    return csv_content

def test_health_check():
    """Test basic health check to ensure API is working"""
    print_test_header("Health Check")
    
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print_result("Health Check", True, f"Status: {data.get('status', 'unknown')}")
            return True
        else:
            print_result("Health Check", False, f"Status: {response.status_code}")
            return False
    except Exception as e:
        print_result("Health Check", False, f"Error: {str(e)}")
        return False

def test_trips_settings():
    """Test AUTO TRIP SETTINGS endpoints"""
    print_test_header("Premium Feature 3: Auto Trip Settings")
    
    try:
        # Test GET /api/trips/settings - should return default settings
        print(f"{Colors.YELLOW}Testing GET /api/trips/settings{Colors.END}")
        response = requests.get(f"{BASE_URL}/trips/settings", headers=HEADERS)
        
        if response.status_code == 200:
            data = response.json()
            print_result("GET Trip Settings", True, 
                        f"Settings: auto_detect_enabled={data.get('auto_detect_enabled')}, "
                        f"default_trip_type={data.get('default_trip_type')}, "
                        f"sensitivity_level={data.get('sensitivity_level')}")
        else:
            print_result("GET Trip Settings", False, f"Status: {response.status_code}")
            return False
        
        # Test POST /api/trips/settings with specified JSON body
        print(f"\n{Colors.YELLOW}Testing POST /api/trips/settings{Colors.END}")
        test_settings = {
            "auto_detect_enabled": True,
            "default_trip_type": "business", 
            "sensitivity_level": "high"
        }
        
        response = requests.post(f"{BASE_URL}/trips/settings", 
                               headers=HEADERS, 
                               json=test_settings)
        
        if response.status_code == 200:
            data = response.json()
            print_result("POST Trip Settings", True, 
                        f"Updated settings saved successfully. ID: {data.get('id', 'N/A')}")
            
            # Verify the settings were saved by getting them again
            verify_response = requests.get(f"{BASE_URL}/trips/settings", headers=HEADERS)
            if verify_response.status_code == 200:
                verify_data = verify_response.json()
                if (verify_data.get('auto_detect_enabled') == True and 
                    verify_data.get('default_trip_type') == 'business' and
                    verify_data.get('sensitivity_level') == 'high'):
                    print_result("Settings Verification", True, "Settings updated correctly")
                else:
                    print_result("Settings Verification", False, "Settings not updated correctly")
            return True
        else:
            print_result("POST Trip Settings", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        print_result("Trip Settings Test", False, f"Error: {str(e)}")
        return False

def test_tax_dates():
    """Test TAX DATES endpoint"""
    print_test_header("Premium Feature 5a: Tax Dates")
    
    try:
        # Test GET /api/tax-dates - should return upcoming tax dates with days_left
        print(f"{Colors.YELLOW}Testing GET /api/tax-dates{Colors.END}")
        response = requests.get(f"{BASE_URL}/tax-dates", headers=HEADERS)
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) > 0:
                print_result("GET Tax Dates", True, f"Found {len(data)} upcoming tax dates")
                
                # Check if each date has required fields including days_left
                for i, tax_date in enumerate(data[:3]):  # Show first 3
                    title = tax_date.get('title', 'N/A')
                    date = tax_date.get('date', 'N/A')
                    days_left = tax_date.get('days_left', 'N/A')
                    print(f"     Date {i+1}: {title} - {date} ({days_left} days left)")
                
                # Check if days_left field exists
                has_days_left = all('days_left' in td for td in data)
                print_result("Tax Dates Format Check", has_days_left, 
                           "All dates have 'days_left' field" if has_days_left else "Missing 'days_left' field")
                return True
            else:
                print_result("GET Tax Dates", False, "No tax dates returned or invalid format")
                return False
        else:
            print_result("GET Tax Dates", False, f"Status: {response.status_code}")
            return False
            
    except Exception as e:
        print_result("Tax Dates Test", False, f"Error: {str(e)}")
        return False

def test_reminders():
    """Test TAX REMINDERS endpoints"""
    print_test_header("Premium Feature 5b: Tax Reminders")
    
    try:
        # Test POST /api/reminders/setup-defaults - should create default reminders
        print(f"{Colors.YELLOW}Testing POST /api/reminders/setup-defaults{Colors.END}")
        response = requests.post(f"{BASE_URL}/reminders/setup-defaults", headers=HEADERS)
        
        if response.status_code == 200:
            data = response.json()
            message = data.get('message', '')
            print_result("Setup Default Reminders", True, f"Result: {message}")
        else:
            print_result("Setup Default Reminders", False, f"Status: {response.status_code}")
            return False
        
        # Test GET /api/reminders - should return reminders
        print(f"\n{Colors.YELLOW}Testing GET /api/reminders{Colors.END}")
        response = requests.get(f"{BASE_URL}/reminders", headers=HEADERS)
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                print_result("GET Reminders", True, f"Found {len(data)} reminders")
                
                # Show first few reminders
                for i, reminder in enumerate(data[:3]):
                    title = reminder.get('title', 'N/A')
                    due_date = reminder.get('due_date', 'N/A')
                    enabled = reminder.get('enabled', False)
                    print(f"     Reminder {i+1}: {title} - {due_date} (Enabled: {enabled})")
                return True
            else:
                print_result("GET Reminders", False, "Invalid response format")
                return False
        else:
            print_result("GET Reminders", False, f"Status: {response.status_code}")
            return False
            
    except Exception as e:
        print_result("Reminders Test", False, f"Error: {str(e)}")
        return False

def test_trip_classification():
    """Test TRIP CLASSIFICATION endpoints"""
    print_test_header("Premium Feature 4: Trip Classification")
    
    try:
        # First, create a test trip using POST /api/trips/auto
        print(f"{Colors.YELLOW}Testing POST /api/trips/auto{Colors.END}")
        test_trip = {
            "start_location": "123 Main St, Test City",
            "end_location": "456 Oak Ave, Test City", 
            "start_lat": 40.7128,
            "start_lng": -74.0060,
            "end_lat": 40.7589,
            "end_lng": -73.9851,
            "distance": 5.2,
            "purpose": "Business",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "is_auto_detected": True
        }
        
        response = requests.post(f"{BASE_URL}/trips/auto", 
                               headers=HEADERS, 
                               json=test_trip)
        
        if response.status_code == 200:
            data = response.json()
            trip_id = data.get('id')
            print_result("POST Auto Trip", True, f"Created trip with ID: {trip_id}")
            
            # Test GET /api/trips/pending
            print(f"\n{Colors.YELLOW}Testing GET /api/trips/pending{Colors.END}")
            response = requests.get(f"{BASE_URL}/trips/pending", headers=HEADERS)
            
            if response.status_code == 200:
                pending_data = response.json()
                if isinstance(pending_data, list):
                    print_result("GET Pending Trips", True, f"Found {len(pending_data)} pending trips")
                    
                    # Show details of pending trips
                    for i, trip in enumerate(pending_data[:3]):
                        start = trip.get('start_location', 'N/A')
                        end = trip.get('end_location', 'N/A')
                        distance = trip.get('distance', 0)
                        purpose = trip.get('purpose', 'N/A')
                        print(f"     Trip {i+1}: {start} → {end} ({distance} miles, {purpose})")
                    return True
                else:
                    print_result("GET Pending Trips", False, "Invalid response format")
                    return False
            else:
                print_result("GET Pending Trips", False, f"Status: {response.status_code}")
                return False
        else:
            print_result("POST Auto Trip", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        print_result("Trip Classification Test", False, f"Error: {str(e)}")
        return False

def test_bank_statement_upload():
    """Test BANK STATEMENT UPLOAD endpoint"""
    print_test_header("Premium Feature 1: Bank Statement Upload")
    
    try:
        # Create a test PDF file
        pdf_content = create_test_pdf()
        
        # Test POST /api/upload/statement
        print(f"{Colors.YELLOW}Testing POST /api/upload/statement{Colors.END}")
        
        files = {
            'file': ('test_statement.pdf', pdf_content, 'application/pdf')
        }
        
        # Note: For file uploads, we don't use JSON headers
        response = requests.post(f"{BASE_URL}/upload/statement", files=files)
        
        if response.status_code == 200:
            data = response.json()
            transactions = data.get('transactions', [])
            total_found = data.get('total_found', 0)
            deductible_count = data.get('deductible_count', 0)
            deductible_total = data.get('deductible_total', 0)
            
            print_result("POST Bank Statement Upload", True, 
                        f"Parsed {total_found} transactions, {deductible_count} deductible (${deductible_total:.2f})")
            
            # Show sample transactions
            for i, tx in enumerate(transactions[:3]):
                desc = tx.get('description', 'N/A')
                amount = tx.get('amount', 0)
                deductible = tx.get('is_deductible', False)
                print(f"     Transaction {i+1}: {desc} - ${amount:.2f} (Deductible: {deductible})")
            
            return True
        else:
            print_result("POST Bank Statement Upload", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        print_result("Bank Statement Upload Test", False, f"Error: {str(e)}")
        return False

def test_csv_import():
    """Test CSV IMPORT endpoint"""
    print_test_header("Premium Feature 2: CSV Import")
    
    try:
        # Create a test CSV file
        csv_content = create_test_csv()
        
        # Test POST /api/upload/csv
        print(f"{Colors.YELLOW}Testing POST /api/upload/csv{Colors.END}")
        
        files = {
            'file': ('test_earnings.csv', csv_content, 'text/csv')
        }
        data = {
            'platform': 'uber'
        }
        
        response = requests.post(f"{BASE_URL}/upload/csv", files=files, data=data)
        
        if response.status_code == 200:
            response_data = response.json()
            total_rows = response_data.get('total_rows', 0)
            imported = response_data.get('imported', 0)
            errors = response_data.get('errors', 0)
            total_amount = response_data.get('total_amount', 0)
            entries = response_data.get('entries', [])
            
            print_result("POST CSV Import", True, 
                        f"Processed {total_rows} rows, imported {imported}, errors {errors}, total ${total_amount:.2f}")
            
            # Show sample entries
            for i, entry in enumerate(entries[:3]):
                source = entry.get('source', 'N/A')
                amount = entry.get('amount', 0)
                date = entry.get('date', 'N/A')
                print(f"     Entry {i+1}: {source} - ${amount:.2f} on {date}")
            
            return True
        else:
            print_result("POST CSV Import", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        print_result("CSV Import Test", False, f"Error: {str(e)}")
        return False

def main():
    """Main testing function"""
    print(f"{Colors.BOLD}{Colors.BLUE}TaxIQ Pro Backend API Testing Suite{Colors.END}")
    print(f"{Colors.BLUE}Testing 5 Premium Feature Endpoints{Colors.END}")
    print(f"{Colors.BLUE}Base URL: {BASE_URL}{Colors.END}")
    
    # Track test results
    results = {}
    
    # Test health check first
    results['health'] = test_health_check()
    
    if not results['health']:
        print(f"\n{Colors.RED}⚠️  API Health Check Failed - Cannot Continue{Colors.END}")
        return
    
    # Test the 5 premium features as requested
    print(f"\n{Colors.BOLD}Testing Premium Features:{Colors.END}")
    
    # Feature 3: Auto Trip Settings (GET and POST as specified)
    results['trip_settings'] = test_trips_settings()
    
    # Feature 5a: Tax Dates (GET as specified)
    results['tax_dates'] = test_tax_dates()
    
    # Feature 5b: Tax Reminders (POST setup-defaults and GET as specified)
    results['reminders'] = test_reminders()
    
    # Feature 4: Trip Classification 
    results['trip_classification'] = test_trip_classification()
    
    # Feature 1: Bank Statement Upload
    results['bank_statement'] = test_bank_statement_upload()
    
    # Feature 2: CSV Import
    results['csv_import'] = test_csv_import()
    
    # Summary
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}TEST SUMMARY{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")
    
    total_tests = len(results)
    passed_tests = sum(1 for success in results.values() if success)
    
    for test_name, success in results.items():
        status = f"{Colors.GREEN}✅ PASS{Colors.END}" if success else f"{Colors.RED}❌ FAIL{Colors.END}"
        print(f"{status} {test_name.replace('_', ' ').title()}")
    
    print(f"\n{Colors.BOLD}Overall: {passed_tests}/{total_tests} tests passed{Colors.END}")
    
    if passed_tests == total_tests:
        print(f"{Colors.GREEN}{Colors.BOLD}🎉 All tests passed! Premium features working correctly.{Colors.END}")
    else:
        print(f"{Colors.YELLOW}⚠️  {total_tests - passed_tests} test(s) failed. Check details above.{Colors.END}")

if __name__ == "__main__":
    main()