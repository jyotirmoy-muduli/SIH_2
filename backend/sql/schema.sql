
CREATE DATABASE IF NOT EXISTS sih_26264
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sih_26264;

CREATE TABLE IF NOT EXISTS institutions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  permanent_id VARCHAR(50) NOT NULL UNIQUE,
  institution_name VARCHAR(255) NOT NULL,
  institution_type VARCHAR(100),
  state VARCHAR(100),
  district VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  role ENUM(
    'ADMIN',
    'BUREAU_OFFICER',
    'VIEWER'
  ) NOT NULL DEFAULT 'VIEWER',
  bureau_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS complaint_cases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  case_number VARCHAR(50) NOT NULL UNIQUE,
  institution_id INT NOT NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  bureau_name VARCHAR(100) NOT NULL,
  complaint_type VARCHAR(100),
  priority ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT')
    NOT NULL DEFAULT 'MEDIUM',
  status ENUM(
    'RECEIVED',
    'UNDER_REVIEW',
    'IN_PROGRESS',
    'AWAITING_RESPONSE',
    'RESOLVED',
    'CLOSED',
    'REOPENED'
  ) NOT NULL DEFAULT 'RECEIVED',
  assigned_to INT NULL,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  due_date DATE NULL,
  resolved_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (institution_id)
    REFERENCES institutions(id),
  FOREIGN KEY (assigned_to)
    REFERENCES users(id),
  INDEX idx_case_status (status),
  INDEX idx_case_bureau (bureau_name),
  INDEX idx_case_priority (priority),
  INDEX idx_case_institution (institution_id)
);

CREATE TABLE IF NOT EXISTS case_actions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  case_id INT NOT NULL,
  action_type VARCHAR(100) NOT NULL,
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  notes TEXT,
  performed_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id)
    REFERENCES complaint_cases(id),
  FOREIGN KEY (performed_by)
    REFERENCES users(id),
  INDEX idx_action_case_date (case_id, created_at)
);

CREATE TABLE IF NOT EXISTS case_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  case_id INT NOT NULL,
  related_case_id INT NOT NULL,
  relationship_type ENUM(
    'POTENTIAL_DUPLICATE',
    'RELATED_COMPLAINT',
    'SAME_INCIDENT'
  ) NOT NULL DEFAULT 'RELATED_COMPLAINT',
  confidence_score DECIMAL(5,2) NULL,
  review_status ENUM(
    'PENDING',
    'CONFIRMED',
    'REJECTED'
  ) NOT NULL DEFAULT 'PENDING',
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id)
    REFERENCES complaint_cases(id),
  FOREIGN KEY (related_case_id)
    REFERENCES complaint_cases(id),
  FOREIGN KEY (reviewed_by)
    REFERENCES users(id),
  UNIQUE KEY unique_case_link (case_id, related_case_id),
  INDEX idx_link_review (review_status)
);

CREATE TABLE IF NOT EXISTS overlap_alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  case_id INT NOT NULL,
  related_case_id INT NOT NULL,
  alert_reason TEXT NOT NULL,
  confidence_score DECIMAL(5,2) NULL,
  status ENUM(
    'PENDING',
    'REVIEWED',
    'DISMISSED'
  ) NOT NULL DEFAULT 'PENDING',
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id)
    REFERENCES complaint_cases(id),
  FOREIGN KEY (related_case_id)
    REFERENCES complaint_cases(id),
  FOREIGN KEY (reviewed_by)
    REFERENCES users(id),
  INDEX idx_alert_status (status)
);
