# Katman İsim Şehir — Makefile
# Hızlı geliştirme komutları

.PHONY: help dev down prod prod-down logs test test-watch test-coverage lint lint-fix migrate seed css validate clean

# Varsayılan komut
help: ## Bu yardım menüsünü göster
	@echo ""
	@echo "  Katman Isim Sehir — Komut Listesi"
	@echo "  =================================="
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo ""

# === Docker ===

dev: ## Docker dev ortamını başlat (hot-reload)
	docker compose -p isk -f docker-compose.dev.yml up --build

down: ## Docker dev ortamını durdur
	docker compose -p isk -f docker-compose.dev.yml down

prod: ## Docker production ortamını başlat
	docker compose -p isk -f docker-compose.prod.yml up -d --build

prod-down: ## Docker production ortamını durdur
	docker compose -p isk -f docker-compose.prod.yml down

logs: ## Production loglarını takip et
	docker compose -p isk -f docker-compose.prod.yml logs -f app --tail=100

# === Veritabanı ===

migrate: ## Migration'ları çalıştır (Docker)
	docker compose -p isk -f docker-compose.dev.yml exec app node server/db/migrate.js

seed: ## Seed verilerini yükle (Docker)
	docker compose -p isk -f docker-compose.dev.yml exec app node server/db/seed.js

# === Test ===

test: ## Tüm testleri çalıştır
	npm test

test-watch: ## Watch modunda test
	npm run test:watch

test-coverage: ## Coverage raporu ile test
	npm run test:coverage

# === Kod Kalitesi ===

lint: ## ESLint çalıştır
	npm run lint

lint-fix: ## ESLint ile otomatik düzelt
	npm run lint:fix

validate: ## Lint + test (CI pipeline simülasyonu)
	npm run validate

# === Build ===

css: ## Tailwind CSS derle
	npm run css:build

# === Temizlik ===

clean: ## Geçici dosyaları temizle
	@echo "Cleaning..."
	@rm -rf coverage/ node_modules/.cache/
	@echo "Done."

# === Kurulum ===

setup: ## Proje ilk kurulumu (env + deps + docker)
	@test -f .env || cp .env.example .env
	npm install
	@echo ""
	@echo "✅ Kurulum tamamlandı!"
	@echo "   1. .env dosyasını düzenleyin"
	@echo "   2. 'make dev' ile başlatın"
	@echo "   3. 'make migrate && make seed' ilk seferde çalıştırın"
