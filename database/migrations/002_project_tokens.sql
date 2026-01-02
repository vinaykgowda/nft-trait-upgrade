-- Add project tokens support
-- This migration adds support for project-specific tokens

-- Create project_tokens table to store tokens associated with projects
CREATE TABLE project_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    token_address VARCHAR(44) NOT NULL,
    token_name VARCHAR(100),
    token_symbol VARCHAR(10),
    decimals INTEGER DEFAULT 9,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, token_address)
);

-- Add indexes for performance
CREATE INDEX idx_project_tokens_project_id ON project_tokens(project_id);
CREATE INDEX idx_project_tokens_enabled ON project_tokens(enabled);

-- Update projects table to include default SOL support
ALTER TABLE projects ADD COLUMN supports_sol BOOLEAN DEFAULT TRUE;

-- Insert SOL as default token for existing projects
INSERT INTO project_tokens (project_id, token_address, token_name, token_symbol, decimals, enabled)
SELECT id, 'So11111111111111111111111111111111111111112', 'Solana', 'SOL', 9, TRUE
FROM projects;