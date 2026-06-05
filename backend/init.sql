-- Initialize ART Workspace Database
-- This script runs when PostgreSQL container first starts

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create default admin user (will be created by application)
-- Password: Admin@123 (change this in production!)
-- This is just a placeholder comment for documentation
