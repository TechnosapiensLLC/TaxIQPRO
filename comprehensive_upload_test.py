#!/usr/bin/env python3
"""
Comprehensive Upload Endpoints Testing
Testing ALL upload endpoints with real files and edge cases
"""

import requests
import json
import os
import io
from PIL import Image
from datetime import datetime

# Configuration
BASE_URL = "https://quick-revenue-apps.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'
    BOLD = '\033[1m'

def print_test_header(test_name):
    print(f"\n{Colors.BLUE}{'='*70}{Colors.END}")
    print(f"{Colors.BLUE}{Colors.BOLD}Testing: {test_name}{Colors.END}")
    print(f"{Colors.BLUE}{'='*70}{Colors.END}")

def print_result(test_name, success, details=""):
    status = f"{Colors.GREEN}✅ PASS{Colors.END}" if success else f"{Colors.RED}❌ FAIL{Colors.END}"
    print(f"{status} {test_name}")
    if details:
        print(f"   {details}")

def create_realistic_tax_pdf():
    """Create a realistic tax filing PDF with actual content"""
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
      /BaseFont /Helvetica-Bold
    >>
    /F2 <<
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
/Length 650
>>
stream
BT
/F1 16 Tf
200 750 Td
(SCHEDULE C) Tj
0 -20 Td
(Profit or Loss From Business) Tj
/F2 12 Tf
0 -40 Td
(Tax Year: 2024) Tj
0 -30 Td
(Name: John Smith) Tj
0 -20 Td
(Business: Rideshare Driver - Uber/Lyft) Tj
0 -40 Td
(INCOME:) Tj
0 -20 Td
(Gross receipts from Uber: $52,000) Tj
0 -20 Td
(Gross receipts from Lyft: $28,500) Tj
0 -20 Td
(Total Income: $80,500) Tj
0 -40 Td
(EXPENSES:) Tj
0 -20 Td
(Vehicle expenses: $9,200) Tj
0 -20 Td
(Insurance: $2,800) Tj
0 -20 Td
(Phone: $1,200) Tj
0 -20 Td
(Supplies: $450) Tj
0 -20 Td
(Total Expenses: $13,650) Tj
0 -40 Td
(NET PROFIT: $66,850) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000062 00000 n 
0000000119 00000 n 
0000000419 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
1119
%%EOF"""
    return pdf_content

def create_bank_statement_pdf():
    """Create a realistic bank statement PDF"""
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
      /BaseFont /Helvetica-Bold
    >>
    /F2 <<
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
/Length 800
>>
stream
BT
/F1 14 Tf
50 750 Td
(BANK STATEMENT - January 2025) Tj
/F2 10 Tf
0 -30 Td
(Account Holder: Jane Doe) Tj
0 -15 Td
(Account Number: ****1234) Tj
0 -30 Td
(TRANSACTIONS:) Tj
0 -20 Td
(01/05/2025  Shell Gas Station          -$52.34) Tj
0 -15 Td
(01/06/2025  Amazon AWS Services        -$29.99) Tj
0 -15 Td
(01/07/2025  Starbucks Coffee           -$6.50) Tj
0 -15 Td
(01/08/2025  Office Depot Supplies      -$124.50) Tj
0 -15 Td
(01/10/2025  Verizon Wireless           -$85.00) Tj
0 -15 Td
(01/12/2025  Chevron Gas                -$48.75) Tj
0 -15 Td
(01/15/2025  Microsoft 365              -$12.99) Tj
0 -15 Td
(01/18/2025  AutoZone Car Parts         -$67.89) Tj
0 -15 Td
(01/20/2025  Costco Business Center     -$156.23) Tj
0 -15 Td
(01/25/2025  State Farm Insurance       -$145.00) Tj
0 -30 Td
(Total Debits: $729.19) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000062 00000 n 
0000000119 00000 n 
0000000419 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
1269
%%EOF"""
    return pdf_content

def create_test_image_jpg():
    """Create a test JPG image with text"""
    img = Image.new('RGB', (800, 600), color='white')
    
    # Save to bytes
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='JPEG')
    img_bytes.seek(0)
    
    return img_bytes.getvalue()

def create_test_image_png():
    """Create a test PNG image"""
    img = Image.new('RGB', (800, 600), color='lightblue')
    
    # Save to bytes
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')
    img_bytes.seek(0)
    
    return img_bytes.getvalue()

def create_earnings_csv():
    """Create a realistic earnings CSV"""
    csv_content = """Date,Amount,Description,Trip ID
2025-01-05,45.50,Uber Trip - Downtown to Airport,TRIP001
2025-01-05,32.75,Uber Trip - Airport to Hotel,TRIP002
2025-01-06,28.90,Uber Trip - Hotel to Convention Center,TRIP003
2025-01-06,67.25,Uber Trip - Long Distance,TRIP004
2025-01-07,19.80,Uber Trip - Short Trip,TRIP005
2025-01-08,52.40,Uber Trip - Evening Rush Hour,TRIP006
2025-01-09,41.30,Uber Trip - Morning Commute,TRIP007
2025-01-10,38.75,Uber Trip - Midday Trip,TRIP008"""
    return csv_content

def test_analyze_filing_pdf():
    """Test POST /api/analyze-filing with PDF file"""
    print_test_header("POST /api/analyze-filing - PDF Upload")
    
    try:
        pdf_content = create_realistic_tax_pdf()
        
        files = {
            'file': ('schedule_c_2024.pdf', pdf_content, 'application/pdf')
        }
        
        print(f"{Colors.YELLOW}Uploading PDF file...{Colors.END}")
        response = requests.post(f"{BASE_URL}/analyze-filing", files=files, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            # Check response structure
            if 'id' not in data or 'filename' not in data or 'analysis' not in data:
                print_result("PDF Upload - Response Structure", False, "Missing required fields")
                return False
            
            print_result("PDF Upload", True, f"File uploaded successfully. ID: {data.get('id')}")
            
            # Verify analysis structure
            analysis = data.get('analysis', {})
            required_fields = [
                'filing_type', 'tax_year', 'total_income', 'total_deductions',
                'missed_deductions', 'recommendations', 'imported_data',
                'insights', 'app_features_to_use', 'potential_savings', 'tax_efficiency_score'
            ]
            
            missing_fields = [f for f in required_fields if f not in analysis]
            
            if missing_fields:
                print_result("Analysis Structure", False, f"Missing fields: {', '.join(missing_fields)}")
                return False
            
            print_result("Analysis Structure", True, "All required fields present")
            
            # Display key data
            print(f"\n{Colors.BOLD}Analysis Results:{Colors.END}")
            print(f"   Filing Type: {analysis.get('filing_type', 'N/A')}")
            print(f"   Tax Year: {analysis.get('tax_year', 'N/A')}")
            print(f"   Total Income: ${analysis.get('total_income', 0):,.2f}")
            print(f"   Total Deductions: ${analysis.get('total_deductions', 0):,.2f}")
            print(f"   Potential Savings: ${analysis.get('potential_savings', 0):,.2f}")
            print(f"   Tax Efficiency Score: {analysis.get('tax_efficiency_score', 0)}/100")
            
            # Check missed deductions
            missed_deductions = analysis.get('missed_deductions', [])
            print(f"   Missed Deductions: {len(missed_deductions)}")
            
            # Check recommendations
            recommendations = analysis.get('recommendations', [])
            print(f"   Recommendations: {len(recommendations)}")
            
            return True
        else:
            print_result("PDF Upload", False, f"Status: {response.status_code}, Response: {response.text[:200]}")
            return False
            
    except Exception as e:
        print_result("PDF Upload Test", False, f"Error: {str(e)}")
        return False

def test_analyze_filing_jpg():
    """Test POST /api/analyze-filing with JPG image"""
    print_test_header("POST /api/analyze-filing - JPG Upload")
    
    try:
        jpg_content = create_test_image_jpg()
        
        files = {
            'file': ('tax_document.jpg', jpg_content, 'image/jpeg')
        }
        
        print(f"{Colors.YELLOW}Uploading JPG image...{Colors.END}")
        response = requests.post(f"{BASE_URL}/analyze-filing", files=files, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            print_result("JPG Upload", True, f"Image uploaded successfully. ID: {data.get('id')}")
            
            # Verify analysis exists
            if 'analysis' in data:
                print_result("JPG Analysis", True, "Analysis returned successfully")
                return True
            else:
                print_result("JPG Analysis", False, "No analysis in response")
                return False
        else:
            print_result("JPG Upload", False, f"Status: {response.status_code}, Response: {response.text[:200]}")
            return False
            
    except Exception as e:
        print_result("JPG Upload Test", False, f"Error: {str(e)}")
        return False

def test_analyze_filing_png():
    """Test POST /api/analyze-filing with PNG image"""
    print_test_header("POST /api/analyze-filing - PNG Upload")
    
    try:
        png_content = create_test_image_png()
        
        files = {
            'file': ('tax_document.png', png_content, 'image/png')
        }
        
        print(f"{Colors.YELLOW}Uploading PNG image...{Colors.END}")
        response = requests.post(f"{BASE_URL}/analyze-filing", files=files, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            print_result("PNG Upload", True, f"Image uploaded successfully. ID: {data.get('id')}")
            
            # Verify analysis exists
            if 'analysis' in data:
                print_result("PNG Analysis", True, "Analysis returned successfully")
                return True
            else:
                print_result("PNG Analysis", False, "No analysis in response")
                return False
        else:
            print_result("PNG Upload", False, f"Status: {response.status_code}, Response: {response.text[:200]}")
            return False
            
    except Exception as e:
        print_result("PNG Upload Test", False, f"Error: {str(e)}")
        return False

def test_analyze_filing_invalid():
    """Test POST /api/analyze-filing with invalid file types"""
    print_test_header("POST /api/analyze-filing - Invalid File Types")
    
    results = []
    
    # Test 1: TXT file
    try:
        txt_content = b"This is a plain text file, not a valid tax document."
        files = {'file': ('document.txt', txt_content, 'text/plain')}
        
        print(f"{Colors.YELLOW}Testing TXT file rejection...{Colors.END}")
        response = requests.post(f"{BASE_URL}/analyze-filing", files=files, timeout=10)
        
        if response.status_code == 400:
            print_result("TXT File Rejection", True, "Correctly rejected with 400 status")
            results.append(True)
        else:
            print_result("TXT File Rejection", False, f"Expected 400, got {response.status_code}")
            results.append(False)
    except Exception as e:
        print_result("TXT File Test", False, f"Error: {str(e)}")
        results.append(False)
    
    # Test 2: DOC file
    try:
        doc_content = b"Fake DOC file content"
        files = {'file': ('document.doc', doc_content, 'application/msword')}
        
        print(f"\n{Colors.YELLOW}Testing DOC file rejection...{Colors.END}")
        response = requests.post(f"{BASE_URL}/analyze-filing", files=files, timeout=10)
        
        if response.status_code == 400:
            print_result("DOC File Rejection", True, "Correctly rejected with 400 status")
            results.append(True)
        else:
            print_result("DOC File Rejection", False, f"Expected 400, got {response.status_code}")
            results.append(False)
    except Exception as e:
        print_result("DOC File Test", False, f"Error: {str(e)}")
        results.append(False)
    
    return all(results)

def test_upload_statement_pdf():
    """Test POST /api/upload/statement with PDF"""
    print_test_header("POST /api/upload/statement - PDF Upload")
    
    try:
        pdf_content = create_bank_statement_pdf()
        
        files = {
            'file': ('bank_statement_jan2025.pdf', pdf_content, 'application/pdf')
        }
        
        print(f"{Colors.YELLOW}Uploading bank statement PDF...{Colors.END}")
        response = requests.post(f"{BASE_URL}/upload/statement", files=files, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            # Check response structure
            required_fields = ['transactions', 'total_found', 'deductible_count', 
                             'deductible_total', 'personal_count', 'personal_total']
            missing_fields = [f for f in required_fields if f not in data]
            
            if missing_fields:
                print_result("Response Structure", False, f"Missing fields: {', '.join(missing_fields)}")
                return False
            
            print_result("PDF Upload", True, "Bank statement uploaded successfully")
            
            # Display summary
            print(f"\n{Colors.BOLD}Statement Summary:{Colors.END}")
            print(f"   Total Transactions: {data.get('total_found', 0)}")
            print(f"   Deductible: {data.get('deductible_count', 0)} (${data.get('deductible_total', 0):.2f})")
            print(f"   Personal: {data.get('personal_count', 0)} (${data.get('personal_total', 0):.2f})")
            
            # Show sample transactions
            transactions = data.get('transactions', [])
            if transactions:
                print(f"\n   Sample Transactions:")
                for i, tx in enumerate(transactions[:3]):
                    desc = tx.get('description', 'N/A')
                    amount = tx.get('amount', 0)
                    deductible = tx.get('is_deductible', False)
                    print(f"      {i+1}. {desc} - ${amount:.2f} (Deductible: {deductible})")
            
            return True
        else:
            print_result("PDF Upload", False, f"Status: {response.status_code}, Response: {response.text[:200]}")
            return False
            
    except Exception as e:
        print_result("Statement Upload Test", False, f"Error: {str(e)}")
        return False

def test_upload_statement_invalid():
    """Test POST /api/upload/statement with invalid file"""
    print_test_header("POST /api/upload/statement - Invalid File Type")
    
    try:
        txt_content = b"This is not a PDF file"
        files = {'file': ('statement.txt', txt_content, 'text/plain')}
        
        print(f"{Colors.YELLOW}Testing invalid file rejection...{Colors.END}")
        response = requests.post(f"{BASE_URL}/upload/statement", files=files, timeout=10)
        
        if response.status_code == 400:
            print_result("Invalid File Rejection", True, "Correctly rejected with 400 status")
            error_detail = response.json().get('detail', '')
            print(f"   Error message: {error_detail}")
            return True
        else:
            print_result("Invalid File Rejection", False, f"Expected 400, got {response.status_code}")
            return False
            
    except Exception as e:
        print_result("Invalid File Test", False, f"Error: {str(e)}")
        return False

def test_upload_csv_valid():
    """Test POST /api/upload/csv with valid CSV"""
    print_test_header("POST /api/upload/csv - Valid CSV Upload")
    
    try:
        csv_content = create_earnings_csv()
        
        files = {
            'file': ('uber_earnings_jan2025.csv', csv_content, 'text/csv')
        }
        data = {
            'platform': 'uber'
        }
        
        print(f"{Colors.YELLOW}Uploading CSV earnings file...{Colors.END}")
        response = requests.post(f"{BASE_URL}/upload/csv", files=files, data=data, timeout=30)
        
        if response.status_code == 200:
            response_data = response.json()
            
            # Check response structure
            required_fields = ['entries', 'total_rows', 'imported', 'errors', 'total_amount']
            missing_fields = [f for f in required_fields if f not in response_data]
            
            if missing_fields:
                print_result("Response Structure", False, f"Missing fields: {', '.join(missing_fields)}")
                return False
            
            print_result("CSV Upload", True, "CSV file uploaded successfully")
            
            # Display summary
            print(f"\n{Colors.BOLD}CSV Import Summary:{Colors.END}")
            print(f"   Total Rows: {response_data.get('total_rows', 0)}")
            print(f"   Imported: {response_data.get('imported', 0)}")
            print(f"   Errors: {response_data.get('errors', 0)}")
            print(f"   Total Amount: ${response_data.get('total_amount', 0):.2f}")
            
            # Show sample entries
            entries = response_data.get('entries', [])
            if entries:
                print(f"\n   Sample Entries:")
                for i, entry in enumerate(entries[:3]):
                    source = entry.get('source', 'N/A')
                    amount = entry.get('amount', 0)
                    date = entry.get('date', 'N/A')
                    print(f"      {i+1}. {source} - ${amount:.2f} on {date}")
            
            return True
        else:
            print_result("CSV Upload", False, f"Status: {response.status_code}, Response: {response.text[:200]}")
            return False
            
    except Exception as e:
        print_result("CSV Upload Test", False, f"Error: {str(e)}")
        return False

def test_upload_csv_platforms():
    """Test POST /api/upload/csv with different platforms"""
    print_test_header("POST /api/upload/csv - Multiple Platforms")
    
    platforms = ['uber', 'lyft', 'doordash']
    results = []
    
    for platform in platforms:
        try:
            csv_content = create_earnings_csv()
            
            files = {
                'file': (f'{platform}_earnings.csv', csv_content, 'text/csv')
            }
            data = {
                'platform': platform
            }
            
            print(f"\n{Colors.YELLOW}Testing platform: {platform}{Colors.END}")
            response = requests.post(f"{BASE_URL}/upload/csv", files=files, data=data, timeout=30)
            
            if response.status_code == 200:
                response_data = response.json()
                imported = response_data.get('imported', 0)
                print_result(f"{platform.title()} CSV", True, f"Imported {imported} entries")
                results.append(True)
            else:
                print_result(f"{platform.title()} CSV", False, f"Status: {response.status_code}")
                results.append(False)
                
        except Exception as e:
            print_result(f"{platform.title()} CSV", False, f"Error: {str(e)}")
            results.append(False)
    
    return all(results)

def test_upload_csv_invalid():
    """Test POST /api/upload/csv with invalid file"""
    print_test_header("POST /api/upload/csv - Invalid File Type")
    
    try:
        txt_content = b"This is not a CSV file"
        files = {'file': ('earnings.txt', txt_content, 'text/plain')}
        data = {'platform': 'uber'}
        
        print(f"{Colors.YELLOW}Testing invalid file rejection...{Colors.END}")
        response = requests.post(f"{BASE_URL}/upload/csv", files=files, data=data, timeout=10)
        
        if response.status_code == 400:
            print_result("Invalid File Rejection", True, "Correctly rejected with 400 status")
            error_detail = response.json().get('detail', '')
            print(f"   Error message: {error_detail}")
            return True
        else:
            print_result("Invalid File Rejection", False, f"Expected 400, got {response.status_code}")
            return False
            
    except Exception as e:
        print_result("Invalid File Test", False, f"Error: {str(e)}")
        return False

def main():
    """Main testing function"""
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*70}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}COMPREHENSIVE UPLOAD ENDPOINTS TESTING{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*70}{Colors.END}")
    print(f"{Colors.BLUE}Base URL: {BASE_URL}{Colors.END}")
    print(f"{Colors.BLUE}Testing Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{Colors.END}")
    
    # Track test results
    results = {}
    
    # Test 1: POST /api/analyze-filing
    print(f"\n{Colors.BOLD}{Colors.YELLOW}ENDPOINT 1: POST /api/analyze-filing{Colors.END}")
    results['analyze_filing_pdf'] = test_analyze_filing_pdf()
    results['analyze_filing_jpg'] = test_analyze_filing_jpg()
    results['analyze_filing_png'] = test_analyze_filing_png()
    results['analyze_filing_invalid'] = test_analyze_filing_invalid()
    
    # Test 2: POST /api/upload/statement
    print(f"\n{Colors.BOLD}{Colors.YELLOW}ENDPOINT 2: POST /api/upload/statement{Colors.END}")
    results['upload_statement_pdf'] = test_upload_statement_pdf()
    results['upload_statement_invalid'] = test_upload_statement_invalid()
    
    # Test 3: POST /api/upload/csv
    print(f"\n{Colors.BOLD}{Colors.YELLOW}ENDPOINT 3: POST /api/upload/csv{Colors.END}")
    results['upload_csv_valid'] = test_upload_csv_valid()
    results['upload_csv_platforms'] = test_upload_csv_platforms()
    results['upload_csv_invalid'] = test_upload_csv_invalid()
    
    # Summary
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*70}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}COMPREHENSIVE TEST SUMMARY{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*70}{Colors.END}")
    
    # Group by endpoint
    print(f"\n{Colors.BOLD}POST /api/analyze-filing:{Colors.END}")
    for key in ['analyze_filing_pdf', 'analyze_filing_jpg', 'analyze_filing_png', 'analyze_filing_invalid']:
        status = f"{Colors.GREEN}✅ PASS{Colors.END}" if results[key] else f"{Colors.RED}❌ FAIL{Colors.END}"
        print(f"  {status} {key.replace('_', ' ').title()}")
    
    print(f"\n{Colors.BOLD}POST /api/upload/statement:{Colors.END}")
    for key in ['upload_statement_pdf', 'upload_statement_invalid']:
        status = f"{Colors.GREEN}✅ PASS{Colors.END}" if results[key] else f"{Colors.RED}❌ FAIL{Colors.END}"
        print(f"  {status} {key.replace('_', ' ').title()}")
    
    print(f"\n{Colors.BOLD}POST /api/upload/csv:{Colors.END}")
    for key in ['upload_csv_valid', 'upload_csv_platforms', 'upload_csv_invalid']:
        status = f"{Colors.GREEN}✅ PASS{Colors.END}" if results[key] else f"{Colors.RED}❌ FAIL{Colors.END}"
        print(f"  {status} {key.replace('_', ' ').title()}")
    
    # Overall summary
    total_tests = len(results)
    passed_tests = sum(1 for success in results.values() if success)
    failed_tests = total_tests - passed_tests
    
    print(f"\n{Colors.BOLD}Overall Results:{Colors.END}")
    print(f"  Total Tests: {total_tests}")
    print(f"  {Colors.GREEN}Passed: {passed_tests}{Colors.END}")
    print(f"  {Colors.RED}Failed: {failed_tests}{Colors.END}")
    print(f"  Success Rate: {(passed_tests/total_tests*100):.1f}%")
    
    if passed_tests == total_tests:
        print(f"\n{Colors.GREEN}{Colors.BOLD}🎉 ALL TESTS PASSED! All upload endpoints working correctly.{Colors.END}")
    else:
        print(f"\n{Colors.YELLOW}⚠️  {failed_tests} test(s) failed. Review details above.{Colors.END}")
    
    return passed_tests == total_tests

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
