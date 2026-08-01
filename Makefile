.PHONY: help install dev build start lint format typecheck docker-build docker-up docker-down clean data-init data-clean

# Default target
help:
	@echo "dev-vis - GitHub Repository DORA Metrics Visualization"
	@echo ""
	@echo "Usage:"
	@echo "  make install      - Install dependencies"
	@echo "  make dev          - Start development server"
	@echo "  make build        - Build for production"
	@echo "  make start        - Start production server"
	@echo ""
	@echo "Quality:"
	@echo "  make lint         - Check lint and formatting (Biome)"
	@echo "  make format       - Apply lint fixes and formatting (Biome)"
	@echo "  make typecheck    - Run the TypeScript compiler"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-build - Build Docker image"
	@echo "  make docker-up    - Start with Docker Compose"
	@echo "  make docker-down  - Stop Docker Compose"
	@echo ""
	@echo "Data:"
	@echo "  make data-init    - Initialize sample data"
	@echo "  make data-clean   - Remove all data"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean        - Remove build artifacts"

# Environment setup
install:
	mise install
	mise exec -- pnpm install

# Development
dev:
	mise exec -- pnpm dev

# Production build
build:
	mise exec -- pnpm build

start:
	mise exec -- pnpm start

# Quality
lint:
	mise exec -- pnpm lint

format:
	mise exec -- pnpm lint:fix

typecheck:
	mise exec -- pnpm typecheck

# Docker
docker-build:
	docker compose build

docker-up:
	docker compose up -d

docker-down:
	docker compose down

# Data management
data-init:
	@mkdir -p data/sample-repo/20250206_120000
	@echo '{"repository":"sample-repo","repository_url":"https://github.com/example/sample-repo","dumped_at":"2025-02-06T12:00:00Z","commit_count":10,"pull_request_count":8,"release_count":5,"issue_count":10}' > data/sample-repo/20250206_120000/metadata.json
	@echo '[{"sha":"abc123","message":"feat: add user authentication","author":{"name":"Alice","email":"alice@example.com","date":"2025-01-15T10:00:00Z"},"committer":{"name":"Alice","email":"alice@example.com","date":"2025-01-15T10:00:00Z"}},{"sha":"def456","message":"fix: resolve login issue","author":{"name":"Bob","email":"bob@example.com","date":"2025-01-16T14:30:00Z"},"committer":{"name":"Bob","email":"bob@example.com","date":"2025-01-16T14:30:00Z"}},{"sha":"ghi789","message":"feat: add dashboard page","author":{"name":"Alice","email":"alice@example.com","date":"2025-01-18T09:00:00Z"},"committer":{"name":"Alice","email":"alice@example.com","date":"2025-01-18T09:00:00Z"}},{"sha":"jkl012","message":"revert: undo dashboard changes","author":{"name":"Bob","email":"bob@example.com","date":"2025-01-19T11:00:00Z"},"committer":{"name":"Bob","email":"bob@example.com","date":"2025-01-19T11:00:00Z"}},{"sha":"mno345","message":"feat: redesign dashboard","author":{"name":"Alice","email":"alice@example.com","date":"2025-01-20T15:00:00Z"},"committer":{"name":"Alice","email":"alice@example.com","date":"2025-01-20T15:00:00Z"}},{"sha":"pqr678","message":"hotfix: critical security patch","author":{"name":"Charlie","email":"charlie@example.com","date":"2025-01-21T08:00:00Z"},"committer":{"name":"Charlie","email":"charlie@example.com","date":"2025-01-21T08:00:00Z"}},{"sha":"stu901","message":"feat: add API endpoints","author":{"name":"Alice","email":"alice@example.com","date":"2025-01-25T10:00:00Z"},"committer":{"name":"Alice","email":"alice@example.com","date":"2025-01-25T10:00:00Z"}},{"sha":"vwx234","message":"docs: update README","author":{"name":"Bob","email":"bob@example.com","date":"2025-01-28T16:00:00Z"},"committer":{"name":"Bob","email":"bob@example.com","date":"2025-01-28T16:00:00Z"}},{"sha":"yza567","message":"feat: add search functionality","author":{"name":"Charlie","email":"charlie@example.com","date":"2025-02-01T09:00:00Z"},"committer":{"name":"Charlie","email":"charlie@example.com","date":"2025-02-01T09:00:00Z"}},{"sha":"bcd890","message":"fix: search pagination bug","author":{"name":"Alice","email":"alice@example.com","date":"2025-02-03T11:00:00Z"},"committer":{"name":"Alice","email":"alice@example.com","date":"2025-02-03T11:00:00Z"}}]' > data/sample-repo/20250206_120000/commits.json
	@echo '[{"number":1,"title":"Add user authentication","state":"closed","created_at":"2025-01-14T08:00:00Z","updated_at":"2025-01-15T10:00:00Z","closed_at":"2025-01-15T10:00:00Z","merged_at":"2025-01-15T10:00:00Z","merge_commit_sha":"abc123","head":{"ref":"feature/auth","sha":"abc123"},"base":{"ref":"main","sha":"000000"},"labels":[{"name":"feature"}]},{"number":2,"title":"Fix login issue","state":"closed","created_at":"2025-01-16T12:00:00Z","updated_at":"2025-01-16T14:30:00Z","closed_at":"2025-01-16T14:30:00Z","merged_at":"2025-01-16T14:30:00Z","merge_commit_sha":"def456","head":{"ref":"fix/login","sha":"def456"},"base":{"ref":"main","sha":"abc123"},"labels":[{"name":"bug"}]},{"number":3,"title":"Add dashboard page","state":"closed","created_at":"2025-01-17T10:00:00Z","updated_at":"2025-01-18T09:00:00Z","closed_at":"2025-01-18T09:00:00Z","merged_at":"2025-01-18T09:00:00Z","merge_commit_sha":"ghi789","head":{"ref":"feature/dashboard","sha":"ghi789"},"base":{"ref":"main","sha":"def456"},"labels":[{"name":"feature"}]},{"number":4,"title":"Redesign dashboard","state":"closed","created_at":"2025-01-19T14:00:00Z","updated_at":"2025-01-20T15:00:00Z","closed_at":"2025-01-20T15:00:00Z","merged_at":"2025-01-20T15:00:00Z","merge_commit_sha":"mno345","head":{"ref":"feature/dashboard-v2","sha":"mno345"},"base":{"ref":"main","sha":"jkl012"},"labels":[{"name":"feature"},{"name":"enhancement"}]},{"number":5,"title":"Critical security patch","state":"closed","created_at":"2025-01-21T06:00:00Z","updated_at":"2025-01-21T08:00:00Z","closed_at":"2025-01-21T08:00:00Z","merged_at":"2025-01-21T08:00:00Z","merge_commit_sha":"pqr678","head":{"ref":"hotfix/security","sha":"pqr678"},"base":{"ref":"main","sha":"mno345"},"labels":[{"name":"hotfix"},{"name":"critical"}]},{"number":6,"title":"Add API endpoints","state":"closed","created_at":"2025-01-22T09:00:00Z","updated_at":"2025-01-25T10:00:00Z","closed_at":"2025-01-25T10:00:00Z","merged_at":"2025-01-25T10:00:00Z","merge_commit_sha":"stu901","head":{"ref":"feature/api","sha":"stu901"},"base":{"ref":"main","sha":"pqr678"},"labels":[{"name":"feature"}]},{"number":7,"title":"Add search functionality","state":"closed","created_at":"2025-01-30T08:00:00Z","updated_at":"2025-02-01T09:00:00Z","closed_at":"2025-02-01T09:00:00Z","merged_at":"2025-02-01T09:00:00Z","merge_commit_sha":"yza567","head":{"ref":"feature/search","sha":"yza567"},"base":{"ref":"main","sha":"vwx234"},"labels":[{"name":"feature"}]},{"number":8,"title":"Fix search pagination","state":"closed","created_at":"2025-02-02T10:00:00Z","updated_at":"2025-02-03T11:00:00Z","closed_at":"2025-02-03T11:00:00Z","merged_at":"2025-02-03T11:00:00Z","merge_commit_sha":"bcd890","head":{"ref":"fix/search-pagination","sha":"bcd890"},"base":{"ref":"main","sha":"yza567"},"labels":[{"name":"bug"}]}]' > data/sample-repo/20250206_120000/pulls.json
	@echo '[{"id":1,"tag_name":"v1.0.0","name":"v1.0.0 - Initial Release","created_at":"2025-01-15T12:00:00Z","published_at":"2025-01-15T12:00:00Z","prerelease":false,"draft":false},{"id":2,"tag_name":"v1.0.1","name":"v1.0.1 - Bug fixes","created_at":"2025-01-17T10:00:00Z","published_at":"2025-01-17T10:00:00Z","prerelease":false,"draft":false},{"id":3,"tag_name":"v1.1.0","name":"v1.1.0 - Dashboard","created_at":"2025-01-21T09:00:00Z","published_at":"2025-01-21T09:00:00Z","prerelease":false,"draft":false},{"id":4,"tag_name":"v1.1.1-hotfix","name":"v1.1.1 - Security Hotfix","created_at":"2025-01-21T10:00:00Z","published_at":"2025-01-21T10:00:00Z","prerelease":false,"draft":false},{"id":5,"tag_name":"v1.2.0","name":"v1.2.0 - API & Search","created_at":"2025-02-03T14:00:00Z","published_at":"2025-02-03T14:00:00Z","prerelease":false,"draft":false}]' > data/sample-repo/20250206_120000/releases.json
	@echo '[{"number":101,"title":"Login button not working on mobile","state":"closed","created_at":"2025-01-16T08:00:00Z","updated_at":"2025-01-16T14:30:00Z","closed_at":"2025-01-16T14:30:00Z","labels":[{"name":"bug"}]},{"number":102,"title":"Add dark mode support","state":"open","created_at":"2025-01-17T09:00:00Z","updated_at":"2025-01-20T10:00:00Z","closed_at":null,"labels":[{"name":"enhancement"}]},{"number":103,"title":"Dashboard crashes on refresh","state":"closed","created_at":"2025-01-18T15:00:00Z","updated_at":"2025-01-19T11:00:00Z","closed_at":"2025-01-19T11:00:00Z","labels":[{"name":"bug"},{"name":"critical"}]},{"number":104,"title":"Security vulnerability in auth module","state":"closed","created_at":"2025-01-21T05:00:00Z","updated_at":"2025-01-21T08:00:00Z","closed_at":"2025-01-21T08:00:00Z","labels":[{"name":"bug"},{"name":"critical"},{"name":"incident"}]},{"number":105,"title":"API rate limiting not working","state":"closed","created_at":"2025-01-26T10:00:00Z","updated_at":"2025-01-27T15:00:00Z","closed_at":"2025-01-27T15:00:00Z","labels":[{"name":"bug"}]},{"number":106,"title":"Documentation improvements","state":"closed","created_at":"2025-01-28T08:00:00Z","updated_at":"2025-01-28T16:00:00Z","closed_at":"2025-01-28T16:00:00Z","labels":[{"name":"documentation"}]},{"number":107,"title":"Search returns wrong results","state":"closed","created_at":"2025-02-01T14:00:00Z","updated_at":"2025-02-02T09:00:00Z","closed_at":"2025-02-02T09:00:00Z","labels":[{"name":"bug"}]},{"number":108,"title":"Pagination breaks with large datasets","state":"closed","created_at":"2025-02-02T08:00:00Z","updated_at":"2025-02-03T11:00:00Z","closed_at":"2025-02-03T11:00:00Z","labels":[{"name":"bug"}]},{"number":109,"title":"Add export to CSV feature","state":"open","created_at":"2025-02-04T09:00:00Z","updated_at":"2025-02-04T09:00:00Z","closed_at":null,"labels":[{"name":"enhancement"}]},{"number":110,"title":"Performance optimization needed","state":"open","created_at":"2025-02-05T11:00:00Z","updated_at":"2025-02-05T11:00:00Z","closed_at":null,"labels":[{"name":"enhancement"}]}]' > data/sample-repo/20250206_120000/issues.json
	@echo "Sample data initialized in data/sample-repo/20250206_120000/"

data-clean:
	rm -rf data/*
	@echo "Data directory cleaned"

# Cleanup
clean:
	rm -rf .next
	rm -rf node_modules
	@echo "Build artifacts cleaned"
