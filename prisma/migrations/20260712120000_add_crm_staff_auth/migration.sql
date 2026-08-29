-- CreateTable
CREATE TABLE "crm_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "crm_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_user_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "crm_user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "crm_role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "crm_role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "crm_user_permissions" (
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "crm_user_permissions_pkey" PRIMARY KEY ("userId","permissionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_users_email_key" ON "crm_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "crm_sessions_sessionToken_key" ON "crm_sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "crm_roles_name_key" ON "crm_roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "crm_permissions_key_key" ON "crm_permissions"("key");

-- AddForeignKey
ALTER TABLE "crm_sessions" ADD CONSTRAINT "crm_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "crm_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_user_roles" ADD CONSTRAINT "crm_user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "crm_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_user_roles" ADD CONSTRAINT "crm_user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "crm_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_role_permissions" ADD CONSTRAINT "crm_role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "crm_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_role_permissions" ADD CONSTRAINT "crm_role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "crm_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_user_permissions" ADD CONSTRAINT "crm_user_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "crm_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_user_permissions" ADD CONSTRAINT "crm_user_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "crm_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
