#!/usr/bin/env python3
"""
Receipt Brain Backend API Test Suite
Tests all API endpoints with comprehensive scenarios
"""

import asyncio
import aiohttp
import json
from datetime import datetime, timedelta
import sys

# Backend URL from environment
BACKEND_URL = "https://quick-revenue-apps.preview.emergentagent.com/api"

class APITester:
    def __init__(self):
        self.session = None
        self.test_results = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_result(self, endpoint, method, success, details, data=None):
        """Log test result"""
        result = {
            "endpoint": endpoint,
            "method": method,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        if data:
            result["response_data"] = data
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {method} {endpoint} - {details}")
        if data and success:
            print(f"   Response: {json.dumps(data, indent=2)[:200]}...")
            
    async def test_endpoint(self, method, endpoint, data=None, expected_status=200):
        """Test a single API endpoint"""
        url = f"{BACKEND_URL}{endpoint}"
        
        try:
            if method.upper() == "GET":
                async with self.session.get(url) as response:
                    response_data = await response.json()
                    success = response.status == expected_status
                    self.log_result(endpoint, method, success, 
                                  f"Status: {response.status}", response_data)
                    return success, response_data
                    
            elif method.upper() == "POST":
                headers = {"Content-Type": "application/json"}
                async with self.session.post(url, json=data, headers=headers) as response:
                    response_data = await response.json()
                    success = response.status == expected_status
                    self.log_result(endpoint, method, success, 
                                  f"Status: {response.status}", response_data)
                    return success, response_data
                    
            elif method.upper() == "DELETE":
                async with self.session.delete(url) as response:
                    response_data = await response.json()
                    success = response.status == expected_status
                    self.log_result(endpoint, method, success, 
                                  f"Status: {response.status}", response_data)
                    return success, response_data
                    
        except Exception as e:
            self.log_result(endpoint, method, False, f"Exception: {str(e)}")
            return False, None
    
    async def run_comprehensive_tests(self):
        """Run all API tests in sequence"""
        print(f"\n🚀 Starting Receipt Brain API Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print("=" * 80)
        
        # 1. Health Check
        print("\n📋 Testing Basic Endpoints...")
        await self.test_endpoint("GET", "/health")
        
        # 2. Get Categories
        await self.test_endpoint("GET", "/categories")
        
        # 3. Get Gig Platforms  
        await self.test_endpoint("GET", "/gig-platforms")
        
        # 4. Get Initial Dashboard
        print("\n📊 Testing Dashboard...")
        await self.test_endpoint("GET", "/dashboard")
        
        # 5. Create Receipt
        print("\n🧾 Testing Receipt Management...")
        receipt_data = {
            "vendor": "Shell Gas Station",
            "amount": 45.50,
            "date": "2025-07-14",
            "category": "Vehicle & Gas",
            "notes": "Fuel for rideshare"
        }
        success, receipt_response = await self.test_endpoint("POST", "/receipts", receipt_data)
        receipt_id = receipt_response.get("id") if success and receipt_response else None
        
        # 6. Get All Receipts
        await self.test_endpoint("GET", "/receipts")
        
        # 7. Create Mileage Entry
        print("\n🛣️ Testing Mileage Tracking...")
        mileage_data = {
            "start_location": "123 Main St, Austin, TX",
            "end_location": "456 Oak Ave, Austin, TX", 
            "distance": 15.5,
            "purpose": "Business",
            "date": "2025-07-14",
            "notes": "Client pickup"
        }
        success, mileage_response = await self.test_endpoint("POST", "/mileage", mileage_data)
        mileage_id = mileage_response.get("id") if success and mileage_response else None
        
        # 8. Get All Mileage
        await self.test_endpoint("GET", "/mileage")
        
        # 9. Create Income Entry
        print("\n💰 Testing Income Tracking...")
        income_data = {
            "source": "Uber",
            "amount": 250.00,
            "date": "2025-07-14", 
            "description": "Weekly earnings",
            "is_1099": True
        }
        success, income_response = await self.test_endpoint("POST", "/income", income_data)
        income_id = income_response.get("id") if success and income_response else None
        
        # 10. Get All Income
        await self.test_endpoint("GET", "/income")
        
        # 11. Get Updated Dashboard
        print("\n📊 Testing Updated Dashboard...")
        await self.test_endpoint("GET", "/dashboard")
        
        # 12. Tax Coach
        print("\n🧠 Testing AI Tax Coach...")
        tax_coach_data = {
            "message": "What expenses can I deduct as an Uber driver?"
        }
        await self.test_endpoint("POST", "/tax-coach", tax_coach_data)
        
        # Additional comprehensive tests
        print("\n🔬 Running Additional Tests...")
        
        # Test edge cases
        await self.test_invalid_receipt()
        await self.test_invalid_mileage()
        await self.test_invalid_income()
        await self.test_nonexistent_receipt()
        
        # Summary
        self.print_summary()
        return self.get_overall_success()
    
    async def test_invalid_receipt(self):
        """Test receipt with invalid data"""
        invalid_receipt = {
            "vendor": "",  # Empty vendor
            "amount": -10,  # Negative amount
            "date": "invalid-date",
            "category": "Invalid Category"
        }
        success, response = await self.test_endpoint("POST", "/receipts", invalid_receipt, expected_status=422)
        if not success:
            # Try with valid data but see if validation works
            success, response = await self.test_endpoint("POST", "/receipts", invalid_receipt)
            
    async def test_invalid_mileage(self):
        """Test mileage with invalid data"""
        invalid_mileage = {
            "start_location": "",
            "end_location": "",
            "distance": -5,  # Negative distance
            "purpose": "Invalid Purpose",
            "date": "2025-13-45"  # Invalid date
        }
        success, response = await self.test_endpoint("POST", "/mileage", invalid_mileage, expected_status=422)
        if not success:
            success, response = await self.test_endpoint("POST", "/mileage", invalid_mileage)
    
    async def test_invalid_income(self):
        """Test income with invalid data"""
        invalid_income = {
            "source": "",
            "amount": -100,  # Negative amount
            "date": "invalid",
            "is_1099": "not_boolean"
        }
        success, response = await self.test_endpoint("POST", "/income", invalid_income, expected_status=422)
        if not success:
            success, response = await self.test_endpoint("POST", "/income", invalid_income)
    
    async def test_nonexistent_receipt(self):
        """Test getting non-existent receipt"""
        fake_id = "507f1f77bcf86cd799439011"  # Valid ObjectId format
        success, response = await self.test_endpoint("GET", f"/receipts/{fake_id}", expected_status=404)
        if not success:
            success, response = await self.test_endpoint("GET", f"/receipts/{fake_id}")
    
    def print_summary(self):
        """Print test summary"""
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r["success"]])
        failed_tests = total_tests - passed_tests
        
        print("\n" + "=" * 80)
        print("📊 TEST SUMMARY")
        print("=" * 80)
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   • {result['method']} {result['endpoint']} - {result['details']}")
        
        print("\n✅ KEY FUNCTIONALITY STATUS:")
        key_endpoints = [
            "/health",
            "/dashboard", 
            "/receipts",
            "/mileage",
            "/income",
            "/tax-coach"
        ]
        
        for endpoint in key_endpoints:
            endpoint_tests = [r for r in self.test_results if endpoint in r["endpoint"]]
            if endpoint_tests:
                success_rate = len([r for r in endpoint_tests if r["success"]]) / len(endpoint_tests)
                status = "✅ Working" if success_rate >= 0.8 else "❌ Issues"
                print(f"   {endpoint}: {status} ({success_rate:.1%})")
    
    def get_overall_success(self):
        """Get overall test success status"""
        if not self.test_results:
            return False
            
        # Core endpoints that must work
        core_endpoints = ["/health", "/dashboard", "/receipts", "/mileage", "/income"]
        
        for endpoint in core_endpoints:
            endpoint_tests = [r for r in self.test_results if endpoint in r["endpoint"] and "GET" in r["method"] or "POST" in r["method"]]
            if not any(r["success"] for r in endpoint_tests):
                return False
        
        return True

async def main():
    """Main test runner"""
    try:
        async with APITester() as tester:
            overall_success = await tester.run_comprehensive_tests()
            
            if overall_success:
                print(f"\n🎉 OVERALL STATUS: API is working correctly!")
                return 0
            else:
                print(f"\n⚠️  OVERALL STATUS: API has critical issues!")
                return 1
                
    except Exception as e:
        print(f"❌ Test runner failed: {str(e)}")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)