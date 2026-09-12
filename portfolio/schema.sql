-- 1. Upgraded Users Table (Matches First Name, Last Name, Email, Password, Provider)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    username VARCHAR(80) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255), -- NULL if user signs up with Google
    auth_provider VARCHAR(30) DEFAULT 'local' CHECK (auth_provider IN ('local', 'google')),
    role VARCHAR(20) DEFAULT 'client' CHECK (role IN ('admin', 'client')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    login_count INT DEFAULT 0,
    last_login_at TIMESTAMP WITH TIME ZONE,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. New Dedicated Table: Login Audit Logs (For tracking every timestamped session)
CREATE TABLE IF NOT EXISTS login_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(200) NOT NULL,
    username VARCHAR(80) NOT NULL,
    email VARCHAR(255) NOT NULL,
    auth_method VARCHAR(50) NOT NULL, -- e.g., 'Standard Form', 'Google OAuth'
    login_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Projects Showcase Table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL,
    image_url TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Trigger: Restrict global pinned items to max 3
CREATE OR REPLACE FUNCTION check_pinned_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_pinned = TRUE THEN
        IF (SELECT COUNT(*) FROM projects WHERE is_pinned = TRUE AND id <> NEW.id) >= 3 THEN
            RAISE EXCEPTION 'Cannot pin more than 3 projects simultaneously.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_pinned_limit ON projects;
CREATE TRIGGER enforce_pinned_limit
BEFORE INSERT OR UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION check_pinned_limit();

-- 5. Trigger: Automatically increment login_count and record timestamp on user record
CREATE OR REPLACE FUNCTION record_user_login()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users
    SET login_count = login_count + 1,
        last_login_at = NEW.login_timestamp
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_record_user_login ON login_audit_logs;
CREATE TRIGGER trigger_record_user_login
AFTER INSERT ON login_audit_logs
FOR EACH ROW
EXECUTE FUNCTION record_user_login();

-- 6. Initial Seed (Admin account & Starter Works)
INSERT INTO users (first_name, last_name, username, email, password_hash, role) 
VALUES ('System', 'Admin', 'admin', 'admin@studio.com', 'admin2026', 'admin')
ON CONFLICT (username) DO NOTHING;

INSERT INTO projects (title, category, image_url, is_pinned) VALUES
('Aura OS', 'Spatial Interaction', 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=700&q=80', TRUE),
('Hyperlight', 'Generative Identity', 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=700&q=80', TRUE),
('Vektor Form', 'Parametric Architecture', 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=700&q=80', FALSE)
ON CONFLICT DO NOTHING;