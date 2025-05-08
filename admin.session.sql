
-- TEST INSERT INTO admin.admin, GENERATE HASHED PASSWORD USING BCRYPT in lib/hash.js
INSERT INTO admin.admin (email, hashed_pass, fname, lname, role, is_active, last_login, department_id)
VALUES (
    'test@mail', 
    '$2b$10$Gbk7OR0UcPMuhK3ix8VFpuFJLfy9u4Zjpn/4CS3nSK7Ss6I/9T.r6', -- Store the secure hashed password
    'John', 
    'Doe', 
    'admin', 
    TRUE, 
    NOW(), 
    (SELECT id FROM admin.department WHERE department_name = 'Technical department')
);



SELECT id FROM admin.department WHERE department_name = 'Technical department';

 -- add a department in the department table
INSERT INTO admin.department (department_name) 
VALUES ('Technical department') 
ON CONFLICT (department_name) DO NOTHING;




SELECT * FROM PROJECT;

SELECT * FROM admin.admin;

-- Insert new admin
INSERT INTO admin.admin 
    (email, hashed_pass, fname, lname, 
    role, is_active, last_login, department_id)
VALUES (
    'tesxst@gmail.com', 
    '$2b$10$sXTHTCyqfkz.5tTdfGhTLOOUbPrIWeNNS79WR4.EFxOFmxQaJn0Ru', 
    'Jane', 
    'Doe', 
    'admin', 
    TRUE, 
    NOW(), 
    (SELECT id FROM admin.department WHERE department_name = 'Technical department')
);

