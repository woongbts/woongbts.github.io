#!/usr/bin/env python3
"""Regression checks for sitemap product-page coverage."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("seo_health", Path(__file__).with_name("seo-health-check.py"))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

class ProductPageChecks(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        audit.ROOT = Path(self.tmp.name)
        audit.errors.clear()
        audit.warnings.clear()
        audit.scanned.clear()
        self.url = audit.SITE + "/rental/product/example/"

    def test_missing_product_is_reported(self):
        audit.audit_page(self.url)
        self.assertTrue(any("Sitemap target missing" in e for e in audit.errors))

    def test_product_canonical_is_checked(self):
        page = audit.ROOT / "rental/product/example/index.html"
        page.parent.mkdir(parents=True)
        page.write_text('<title>Example</title><meta name="description" content="Example">'
                        '<link rel="canonical" href="https://woongbts.github.io/wrong/">',
                        encoding="utf-8")
        audit.audit_page(self.url)
        self.assertTrue(any("Wrong canonical" in e for e in audit.errors))

if __name__ == "__main__":
    unittest.main()
