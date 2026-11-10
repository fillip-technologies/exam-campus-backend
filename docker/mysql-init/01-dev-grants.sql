-- Local development only: Prisma Migrate needs to create a temporary "shadow" database.
GRANT ALL PRIVILEGES ON *.* TO 'examcampus'@'%';
FLUSH PRIVILEGES;
