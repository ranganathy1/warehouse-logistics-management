# Warehouse & Logistics Management System — AWS / EKS Deployment Guide

This guide explains how to deploy the Warehouse & Logistics Management System (WLMS) from source code to Amazon EKS using:

- React frontend
- FastAPI backend
- Docker
- Amazon ECR
- Amazon EKS
- Kubernetes
- PostgreSQL on Amazon RDS
- GitHub Actions
- GitHub OIDC + AWS IAM
- AWS Load Balancer Controller
- Optional AWS Application Load Balancer (ALB)

The goal is that another developer can follow this document from an empty AWS/GitHub setup to a working deployment without needing undocumented manual steps.

---

# 1. Architecture

For the visual architecture diagram, refer to [Deployment_Architecture.png](Deployment_Architecture.png).

The GitHub Actions workflow run is shown here:

![Successful GitHub Actions run](github-actions-success.png)

The application has three main runtime parts:

```text
                         GitHub
                           |
                           | push to master
                           v
                    GitHub Actions
                           |
                    GitHub OIDC / IAM
                           |
              +------------+-------------+
              |                          |
              v                          v
         Amazon ECR                 Amazon EKS
     +----------------+       +----------------------+
     | wlms-backend   |       | Frontend Deployment  |
     | wlms-frontend  |       | Backend Deployment   |
     +----------------+       +----------+-----------+
                                         |
                                         v
                                  PostgreSQL RDS
```

If public access is enabled, the request path becomes:

```text
Browser
   |
   v
Route 53 DNS
   |
   v
ACM HTTPS certificate
   |
   v
Internet-facing AWS ALB
   |
   v
AWS Load Balancer Controller
   |
   v
Kubernetes Services
   |
   +----> React frontend
   |
   +----> FastAPI backend
              |
              v
         Private RDS
```

## Current project deployment mode

The repository can be deployed without making the application public.

In the current low-cost learning setup:

- EKS is running.
- RDS is private.
- Frontend and backend services are `ClusterIP`.
- `k8s/ingress.yaml` exists for a future public deployment.
- `k8s/kustomization.yaml` does **not** include `ingress.yaml`, so CI/CD does not create an ALB.
- The application can be tested with `kubectl port-forward`.

This is useful for learning CI/CD while avoiding unnecessary public infrastructure.

---

# 2. Repository structure

The important deployment files are:

```text
.
├── .github/
│   └── workflows/
│       └── deploy.yml
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   └── tests/
├── k8s/
│   ├── backend.yaml
│   ├── configmap.yaml
│   ├── frontend.yaml
│   ├── ingress.yaml
│   └── kustomization.yaml
├── wlms-frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── package-lock.json
├── SQL/
│   ├── Tables.sql
│   ├── Triggers.sql
│   ├── Views.sql
│   └── Procedures.sql
├── DEPLOYMENT.md
└── README.md
```

Do not commit:

```text
backend/.env
.env
.env.*
AWS access keys
database passwords
JWT secrets
Kubernetes Secret manifests containing real credentials
temporary AWS/IAM policy files
```

The repository `.gitignore` should protect environment files and local AWS working files.

---

# 3. Prerequisites

Install these tools on the development machine:

- Git
- AWS CLI
- kubectl
- Helm 3
- Docker
- Python 3.12
- Node.js 22 / npm

Verify:

```bash
git --version
aws --version
kubectl version --client
helm version
docker --version
python --version
node --version
npm --version
```

Authenticate the AWS CLI:

```bash
aws configure
```

Set the AWS region:

```bash
aws configure set region eu-north-1
```

Verify the identity:

```bash
aws sts get-caller-identity
```

Use the same AWS region for EKS, ECR, and RDS unless there is a specific reason not to.

---

# 4. AWS region

This project uses:

```text
eu-north-1
```

Stockholm is only an example for this repository. If you use another region, replace it consistently everywhere.

Do not accidentally create ECR repositories, RDS, or EKS resources in different regions.

---

# 5. VPC and networking

Create one VPC for the project.

Example:

```text
VPC CIDR: 10.0.0.0/16
```

Use at least two Availability Zones.

A typical layout is:

```text
Public subnet AZ-a
Public subnet AZ-b

Private subnet AZ-a
Private subnet AZ-b
```

The public subnets can host:

- EKS worker nodes, if the design does not use NAT
- internet-facing ALB

The private subnets should host:

- RDS

## Important cost/networking note

A private EKS node design normally needs a NAT gateway or appropriate VPC endpoints for outbound AWS/API access.

NAT gateways can be expensive for a small learning project.

The current low-cost project therefore uses worker nodes with public IPs and keeps RDS private.

Do not make RDS public just to make connectivity easier.

---

# 6. Create the EKS cluster

Create:

```text
Cluster name: wlms-cluster
Region: eu-north-1
Kubernetes: current supported version
```

Use a managed node group with at least two worker nodes.

For a small learning project, a small On-Demand instance type such as `t3.small` can be used if available and appropriate for the account.

Example:

```text
Node group: wlms-nodes
Desired: 2
Minimum: 2
Maximum: 2
```

After the cluster becomes active, configure kubectl:

```bash
aws eks update-kubeconfig \
  --region eu-north-1 \
  --name wlms-cluster
```

Verify:

```bash
kubectl get nodes
```

Expected:

```text
NAME                         STATUS   ROLES    AGE   VERSION
...                          Ready    <none>   ...   ...
...                          Ready    <none>   ...   ...
```

You need administrator access to the cluster during initial setup.

---

# 7. EKS node IAM role

The worker-node IAM role needs the permissions required for normal EKS node operation and pulling private images from ECR.

At minimum, configure the standard EKS worker/node permissions and ECR pull permissions.

For ECR, a policy such as:

```text
AmazonEC2ContainerRegistryPullOnly
```

can be used.

The nodes also need network connectivity to:

- EKS control-plane endpoints
- ECR
- other AWS services required by the cluster
- RDS on TCP 5432

Do not give the node role unnecessary application-level permissions.

---

# 8. Create private ECR repositories

Create:

```text
wlms-backend
wlms-frontend
```

Example:

```bash
aws ecr create-repository \
  --repository-name wlms-backend \
  --region eu-north-1

aws ecr create-repository \
  --repository-name wlms-frontend \
  --region eu-north-1
```

Verify:

```bash
aws ecr describe-repositories \
  --repository-names wlms-backend wlms-frontend \
  --region eu-north-1
```

The repositories should remain private.

The CI/CD role will push images.

The EKS nodes will pull images.

---

# 9. Create PostgreSQL RDS

Create a PostgreSQL RDS instance in the same VPC.

Recommended small-project properties:

```text
Engine: PostgreSQL
Public access: No
Availability: Single-AZ for a learning project
Database: wlmsdb
Master username: postgres
Storage: small/free-tier-eligible size where applicable
```

Use a DB subnet group containing the two private subnets.

Example:

```text
wlms-db-subnet-group
    |
    +-- private subnet AZ-a
    +-- private subnet AZ-b
```

Do not expose PostgreSQL directly to the internet.

## Free-tier warning

AWS free-tier eligibility depends on the AWS account, region, resource configuration, and current AWS pricing rules.

Do not assume that an RDS instance or EKS cluster is permanently free.

Check the AWS billing/free-tier page for the account before creating resources.

---

# 10. RDS security group

Create a dedicated security group for RDS.

Example:

```text
wlms-rds-sg
```

Inbound:

```text
Protocol: TCP
Port: 5432
Source: EKS worker/pod security group
```

Do not use:

```text
0.0.0.0/0
```

for PostgreSQL.

The desired relationship is:

```text
EKS security group
        |
        | TCP 5432
        v
RDS security group
        |
        v
PostgreSQL
```

Verify the RDS security group contains only the required application source.

---

# 11. Initialize the database

The schema is initialized manually once.

Connect to RDS from a location that has network access to the private database.

Run these files in exactly this order:

```text
SQL/Tables.sql
SQL/Triggers.sql
SQL/Views.sql
SQL/Procedures.sql
```

The order matters because later objects depend on earlier database objects.

Do not run the SQL scripts on every GitHub Actions deployment.

The application deployment workflow does not perform database migrations.

## Important

`Procedures.sql` contains sample transaction blocks that depend on sample supplier/customer records. If those records do not exist, those sample blocks can fail even though the stored procedures themselves were created successfully.

Do not invent seed data just to make those sample blocks succeed.

For future schema changes, use a proper migration process rather than repeatedly running the complete initialization scripts.

---

# 12. Create the Kubernetes namespace

Create the namespace once:

```bash
kubectl create namespace wlms
```

Verify:

```bash
kubectl get namespace wlms
```

If the namespace already exists, do not recreate it.

---

# 13. Create the backend runtime secret

The backend expects:

```text
DB_URL
JWT_SECRET_KEY
```

These values must not be stored in GitHub or committed to Git.

For example, a local `backend/.env` can contain:

```text
DB_URL=postgresql://USER:PASSWORD@RDS_ENDPOINT:5432/wlmsdb
JWT_SECRET_KEY=LONG_RANDOM_SECRET
```

Make sure:

```text
backend/.env
```

is ignored by Git.

Create the Kubernetes Secret:

```bash
kubectl create secret generic wlms-backend-secrets \
  -n wlms \
  --from-env-file=backend/.env
```

Verify only the metadata:

```bash
kubectl get secret wlms-backend-secrets -n wlms
```

Do not print the secret values.

## Updating an existing Secret

If the Secret already exists:

```bash
kubectl create secret generic wlms-backend-secrets \
  -n wlms \
  --from-env-file=backend/.env \
  --dry-run=client -o yaml | kubectl apply -f -
```

If your database password contains special characters, URL-encode it when constructing the PostgreSQL connection URL.

For production workloads, protect Kubernetes Secret access and consider EKS secret encryption with AWS KMS.

---

# 14. Kubernetes configuration

The Kubernetes application consists of:

```text
ConfigMap
Backend Deployment
Backend Service
Frontend Deployment
Frontend Service
```

`k8s/kustomization.yaml` controls what CI/CD applies.

The current private deployment intentionally contains:

```yaml
resources:
  - configmap.yaml
  - backend.yaml
  - frontend.yaml
```

It does not contain:

```yaml
- ingress.yaml
```

Therefore no ALB is created by the current CI/CD deployment.

---

# 15. Backend Kubernetes resources

The backend deployment:

```text
Deployment: wlms-backend
Replicas: 2
Container port: 8000
Service: wlms-backend
Service type: ClusterIP
```

The backend reads:

```text
DB_URL
JWT_SECRET_KEY
```

from:

```text
wlms-backend-secrets
```

The deployment also uses the application ConfigMap.

Health probes should point to an endpoint that the FastAPI application actually serves.

Do not use:

```text
uvicorn ... --reload
```

in the production container.

---

# 16. Frontend Kubernetes resources

The frontend deployment:

```text
Deployment: wlms-frontend
Replicas: 2
Container port: 8080
Service: wlms-frontend
Service type: ClusterIP
```

The frontend is served by Nginx.

The frontend's API URL is compiled into the frontend JavaScript during the Docker build.

This is important:

```text
VITE_API_URL
```

is a build-time value.

Changing the GitHub variable does not change an already-built image.

A new deployment/image build is required.

---

# 17. Frontend CORS configuration

`k8s/configmap.yaml` contains:

```text
FRONTEND_ORIGINS
```

For a public HTTPS deployment, use the exact frontend origin, for example:

```text
https://wlms.com
```

Do not add a trailing slash or path.

Correct:

```text
https://wlms.com
```

Avoid:

```text
https://wlms.com/
https://wlms.com/app
```

For local port-forward testing, use the actual browser origin, such as:

```text
http://localhost:8080
```

if the backend CORS implementation expects that origin.

---

# 18. AWS Load Balancer Controller

The AWS Load Balancer Controller is required only when Kubernetes Ingress should create AWS ALBs.

Install it using the official AWS EKS documentation:

https://docs.aws.amazon.com/eks/latest/userguide/aws-load-balancer-controller.html

The controller needs:

1. EKS OIDC provider
2. IAM policy
3. IAM role
4. Kubernetes service account
5. Service-account annotation
6. Helm installation
7. correctly tagged subnets

Verify the controller:

```bash
kubectl get deployment \
  -n kube-system \
  aws-load-balancer-controller
```

Expected:

```text
READY   2/2
```

Check pods:

```bash
kubectl get pods -n kube-system \
  -l app.kubernetes.io/name=aws-load-balancer-controller
```

If you are not using an Ingress, the controller can remain installed without creating an ALB.

---

# 19. Optional: public ALB deployment

The public deployment is optional.

To expose the application publicly, `k8s/ingress.yaml` must be configured correctly.

The Ingress should contain:

```text
internet-facing ALB
target-type: ip
HTTP/HTTPS listeners
HTTPS certificate ARN
frontend hostname
API hostname
```

Example hostnames:

```text
wlms.com
api.wlms.com
```

Replace example values in `k8s/ingress.yaml`.

Do not deploy an example certificate ARN.

Before enabling it, make sure:

- ACM certificate exists
- certificate covers the required hostnames
- certificate is in the same AWS region as the ALB
- public subnets are correctly tagged for ALB discovery
- security groups permit required traffic
- Kubernetes Services and Pods are healthy

Then add `ingress.yaml` to `k8s/kustomization.yaml`:

```yaml
resources:
  - configmap.yaml
  - backend.yaml
  - frontend.yaml
  - ingress.yaml
```

After deployment:

```bash
kubectl get ingress -n wlms
```

The ALB hostname will appear in the `ADDRESS` field.

---

# 20. ACM certificate

For HTTPS, request a public ACM certificate for the required hostnames.

For example:

```text
wlms.com
api.wlms.com
```

Use DNS validation.

The certificate must be in the same region where the ALB is created.

For example, if the ALB is in:

```text
eu-north-1
```

the ACM certificate used by that ALB must also be in:

```text
eu-north-1
```

Do not copy a certificate ARN from another region.

---

# 21. DNS

If using the public deployment, create DNS records for:

```text
wlms.com
api.wlms.com
```

Point them to the ALB using appropriate Route 53 alias records or equivalent DNS configuration.

Verify DNS resolution before expecting HTTPS to work.

If DNS is not configured, the ALB may exist but the hostname will not work.

---

# 22. GitHub Actions workflow

The workflow is:

```text
.github/workflows/deploy.yml
```

It runs validation on:

```text
pull_request
```

It runs deployment on:

```text
push to master
```

The deployment job waits for:

```text
backend-checks
frontend-checks
```

to succeed.

The overall flow is:

```text
Pull Request
   |
   +--> Backend Ruff
   +--> Backend pytest
   +--> Frontend lint
   +--> Frontend tests
   +--> Frontend production build

Push to master
   |
   +--> same checks
   |
   +--> GitHub OIDC
   |
   +--> AWS IAM role
   |
   +--> ECR login
   |
   +--> Docker build
   |
   +--> ECR push
   |
   +--> EKS kubeconfig
   |
   +--> Kustomize
   |
   +--> kubectl apply
   |
   +--> rollout status
```

Images are tagged with:

```text
${{ github.sha }}
```

This gives every deployment an immutable image tag.

---

# 23. GitHub repository variables

Go to:

```text
GitHub repository
→ Settings
→ Secrets and variables
→ Actions
→ Variables
```

Create:

| Variable | Example |
|---|---|
| `AWS_REGION` | `eu-north-1` |
| `EKS_CLUSTER_NAME` | `wlms-cluster` |
| `VITE_API_URL` | `https://api.wlms.com` |

For the private/local deployment, an appropriate development value may be:

```text
http://localhost:8000
```

Remember that this value is compiled into the frontend image.

---

# 24. GitHub Actions secret

Go to:

```text
GitHub repository
→ Settings
→ Secrets and variables
→ Actions
→ Secrets
```

Create:

```text
AWS_DEPLOY_ROLE_ARN
```

Value:

```text
arn:aws:iam::<AWS_ACCOUNT_ID>:role/WLMS-GitHubActions-DeployRole
```

Do not put:

```text
DB_URL
JWT_SECRET_KEY
```

in GitHub Actions.

Those belong in the Kubernetes Secret.

---

# 25. GitHub OIDC provider

GitHub Actions should use OIDC instead of long-lived AWS access keys.

Create an IAM OIDC provider for:

```text
https://token.actions.githubusercontent.com
```

The client ID/audience must include:

```text
sts.amazonaws.com
```

Verify:

```bash
aws iam list-open-id-connect-providers
```

You should see the GitHub provider:

```text
arn:aws:iam::<AWS_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com
```

Do not create IAM access keys specifically for GitHub Actions.

---

# 26. GitHub Actions IAM role

Create:

```text
WLMS-GitHubActions-DeployRole
```

The role trust policy must allow:

```text
sts:AssumeRoleWithWebIdentity
```

from the GitHub OIDC provider.

For a traditional branch subject, the trust condition is:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<AWS_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:OWNER/REPOSITORY:ref:refs/heads/master"
        }
      }
    }
  ]
}
```

Replace:

```text
<AWS_ACCOUNT_ID>
OWNER
REPOSITORY
```

with the real values.

For this repository:

```text
OWNER: ranganathy1
REPOSITORY: warehouse-logistics-management
BRANCH: master
```

## Important GitHub OIDC subject note

GitHub can use different subject formats depending on repository configuration and GitHub's current OIDC behavior.

If:

```text
AssumeRoleWithWebIdentity
```

is denied even though the repository and branch appear correct, inspect the actual OIDC `sub` claim before broadening the IAM policy.

A temporary diagnostic step can decode only the non-secret JWT claims:

```yaml
- name: Debug GitHub OIDC subject
  uses: actions/github-script@v7
  with:
    script: |
      const token = await core.getIDToken('sts.amazonaws.com');
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64url').toString()
      );
      console.log('OIDC sub:', payload.sub);
      console.log('OIDC aud:', payload.aud);
```

Use the observed `sub` to create the narrowest possible trust condition.

Remove the diagnostic step after troubleshooting.

Do not print the complete OIDC token.

---

# 27. IAM permissions for GitHub Actions

The GitHub Actions role needs permissions for the operations performed by the workflow.

## ECR

Allow:

```text
ecr:GetAuthorizationToken
```

on:

```text
*
```

and the image push operations on the two repository ARNs:

```text
ecr:BatchCheckLayerAvailability
ecr:CompleteLayerUpload
ecr:InitiateLayerUpload
ecr:PutImage
ecr:UploadLayerPart
```

Scope those repository actions to:

```text
arn:aws:ecr:<REGION>:<ACCOUNT_ID>:repository/wlms-backend
arn:aws:ecr:<REGION>:<ACCOUNT_ID>:repository/wlms-frontend
```

## EKS

Allow:

```text
eks:DescribeCluster
```

only for:

```text
arn:aws:eks:<REGION>:<ACCOUNT_ID>:cluster/wlms-cluster
```

The IAM role does not need broad AdministratorAccess.

---

# 28. EKS access for GitHub Actions

Create an EKS access entry for:

```text
arn:aws:iam::<AWS_ACCOUNT_ID>:role/WLMS-GitHubActions-DeployRole
```

Then grant Kubernetes permissions limited to the application namespace.

For example:

```text
Policy: AmazonEKSEditPolicy
Scope: namespace
Namespace: wlms
```

This separates:

```text
AWS IAM authentication
```

from:

```text
Kubernetes authorization
```

The role can authenticate to EKS but is only allowed to edit resources in the `wlms` namespace.

---

# 29. Test GitHub OIDC before the first deployment

The workflow must contain:

```yaml
permissions:
  contents: read
  id-token: write
```

The deployment job already uses:

```yaml
- uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
    aws-region: ${{ vars.AWS_REGION }}
```

If this step fails with:

```text
Could not assume role with OIDC:
Not authorized to perform sts:AssumeRoleWithWebIdentity
```

check, in this order:

1. GitHub OIDC provider exists.
2. Provider URL is `token.actions.githubusercontent.com`.
3. Provider client ID includes `sts.amazonaws.com`.
4. `AWS_DEPLOY_ROLE_ARN` points to the intended role.
5. The role trust policy references the correct OIDC provider ARN.
6. The repository owner/name are exact.
7. The branch subject matches the actual GitHub OIDC `sub`.
8. The workflow has `id-token: write`.

---

# 30. First CI/CD deployment

Commit the application and deployment files:

```bash
git status
git add .
git commit -m "ci: add AWS EKS deployment pipeline"
git push origin master
```

GitHub Actions should start automatically.

Open:

```text
GitHub
→ Actions
→ Build and deploy
```

The expected order is:

```text
backend-checks
frontend-checks
deploy
```

Deployment should not start until both check jobs pass.

---

# 31. What the deployment job does

The deployment job:

1. Checks out the repository.
2. Validates required GitHub variables.
3. Requests temporary AWS credentials through GitHub OIDC.
4. Logs in to ECR.
5. Builds the backend Docker image.
6. Builds the frontend Docker image.
7. Pushes both images to ECR.
8. Configures kubectl for EKS.
9. Changes the Kustomize image tags to the current Git SHA.
10. Applies the Kubernetes manifests.
11. Waits for the backend rollout.
12. Waits for the frontend rollout.

The workflow does not:

- create RDS
- run database migrations
- recreate the Kubernetes Secret
- create DNS records
- create an ACM certificate
- automatically seed application data

Those are intentionally separate operations.

---

# 32. Verify the deployment

After a successful GitHub Actions run:

```bash
kubectl get pods -n wlms
```

Expected:

```text
wlms-backend-...    1/1   Running
wlms-backend-...    1/1   Running
wlms-frontend-...   1/1   Running
wlms-frontend-...   1/1   Running
```

Check services:

```bash
kubectl get svc -n wlms
```

Expected private services:

```text
wlms-backend
wlms-frontend
```

Check all application resources:

```bash
kubectl get all -n wlms
```

Check rollout:

```bash
kubectl rollout status deployment/wlms-backend -n wlms
kubectl rollout status deployment/wlms-frontend -n wlms
```

---

# 33. Test the private deployment locally

Because the current Services are `ClusterIP`, they are not directly reachable from the internet.

Forward the backend:

```bash
kubectl port-forward \
  svc/wlms-backend \
  8000:8000 \
  -n wlms
```

Keep that terminal open.

Test:

```text
http://localhost:8000/
```

Forward the frontend in another terminal.

The exact local port depends on the frontend container/service configuration. For example:

```bash
kubectl port-forward \
  svc/wlms-frontend \
  8080:80 \
  -n wlms
```

Then open:

```text
http://localhost:8080
```

If the frontend calls:

```text
http://localhost:8000
```

the backend port-forward must also remain running.

If the browser reports a CORS error, make sure `FRONTEND_ORIGINS` in the Kubernetes ConfigMap matches the actual browser origin.

After changing the ConfigMap:

```bash
kubectl apply -f k8s/configmap.yaml
```

and restart the backend if necessary:

```bash
kubectl rollout restart deployment/wlms-backend -n wlms
```

---

# 34. Test the database connection

The backend should connect to:

```text
RDS private endpoint
    |
    v
PostgreSQL 5432
```

The application does not need a public database address.

If the backend cannot connect, check:

```bash
kubectl get pods -n wlms
kubectl logs deployment/wlms-backend -n wlms
```

Then verify:

- RDS is available.
- RDS security group allows EKS source security group on TCP 5432.
- `DB_URL` is correct.
- database name is correct.
- username/password are correct.
- password special characters are URL-encoded.
- RDS and EKS are in the expected VPC/network.

Do not expose PostgreSQL publicly as a troubleshooting shortcut.

---

# 35. Debugging GitHub Actions

## OIDC error

Error:

```text
Could not assume role with OIDC
Not authorized to perform sts:AssumeRoleWithWebIdentity
```

Check IAM trust policy and the actual GitHub `sub`.

## ECR permission error

Errors mentioning:

```text
ecr:PutImage
ecr:InitiateLayerUpload
ecr:UploadLayerPart
```

Check the GitHub Actions IAM role's ECR policy.

## EKS access error

Errors from:

```text
kubectl apply
```

after AWS credentials succeed usually indicate EKS/Kubernetes authorization rather than OIDC.

Check the EKS access entry and namespace-scoped policy.

## Image pull error

If Pods show:

```text
ImagePullBackOff
```

check:

```bash
kubectl describe pod <POD_NAME> -n wlms
```

Common causes:

- incorrect ECR image URI
- wrong AWS region
- EKS node lacks ECR pull permissions
- image was not pushed
- image tag is wrong

## Pod starts and crashes

Check:

```bash
kubectl logs <POD_NAME> -n wlms
```

For the previous crashed container:

```bash
kubectl logs <POD_NAME> -n wlms --previous
```

---

# 36. Local backend checks

From the repository root:

```bash
cd backend
```

Install development dependencies:

```bash
python -m pip install -r requirements-dev.txt
```

Run Ruff:

```bash
ruff check .
```

Run tests:

```bash
python -m pytest -q
```

---

# 37. Local frontend checks

From the repository root:

```bash
cd wlms-frontend
```

Install dependencies:

```bash
npm ci
```

Run lint:

```bash
npm run lint
```

Run tests:

```bash
npm test
```

Build:

```bash
npm run build
```

These are the same categories of checks used by GitHub Actions.

---

# 38. Pull requests

The workflow runs validation for pull requests.

A pull request should pass:

```text
Backend:
    Ruff
    pytest

Frontend:
    lint
    tests
    production build
```

Deployment should happen only after code is pushed to the deployment branch.

For this repository, that branch is:

```text
master
```

If you change the branch name, update all three places:

1. GitHub Actions trigger
2. deployment `if` condition
3. GitHub OIDC IAM trust policy

---

# 39. Branch protection

For a team repository, protect the deployment branch.

Recommended controls:

- Require pull requests.
- Require successful status checks.
- Require review where appropriate.
- Prevent direct pushes if the project needs controlled releases.

If using:

```text
master
```

protect `master`.

If the project is changed to:

```text
main
```

update the workflow and IAM trust policy at the same time.

---

# 40. Image tagging strategy

The workflow uses:

```text
${{ github.sha }}
```

instead of relying only on:

```text
latest
```

For example:

```text
wlms-backend:640cc4c...
wlms-frontend:640cc4c...
```

This makes each deployment traceable to a specific Git commit.

Do not manually push `latest` as part of the normal deployment process unless there is a specific reason.

---

# 41. Database deployment strategy

The CI/CD pipeline does not automatically execute:

```text
Tables.sql
Triggers.sql
Views.sql
Procedures.sql
```

This is intentional.

Database schema changes should be handled through a controlled migration process.

For a production system, a migration tool/process should provide:

- ordered migrations
- version tracking
- rollback strategy
- backups
- controlled deployment
- testing against a non-production database first

Do not add automatic destructive SQL execution to the application deployment job.

---

# 42. Security checklist

Before considering the deployment production-ready, verify:

- [ ] RDS has public access disabled.
- [ ] RDS security group allows only the EKS application source.
- [ ] No database password is committed.
- [ ] No JWT secret is committed.
- [ ] No AWS access keys are committed.
- [ ] GitHub uses OIDC rather than long-lived AWS keys.
- [ ] GitHub IAM trust is restricted to the correct repository and deployment branch.
- [ ] ECR push permissions are repository-scoped.
- [ ] GitHub EKS access is namespace-scoped.
- [ ] EKS nodes have only required IAM permissions.
- [ ] Kubernetes Secrets are protected.
- [ ] HTTPS is used before exposing the application publicly.
- [ ] The ALB security configuration is reviewed before public deployment.
- [ ] Database backups are configured appropriately.
- [ ] Application logs do not contain credentials.

---

# 43. Cost-control checklist

This is a learning project, so cost control matters.

Resources that can generate charges include:

- EKS cluster
- EC2 worker nodes
- public IPv4 addresses
- RDS
- ALB
- NAT gateways
- ECR storage
- other AWS networking/storage resources

The current private deployment intentionally avoids creating an ALB.

If you are not actively using the project, consider deleting the AWS resources when finished practicing.

Before deleting anything, make sure you understand:

- whether the database contains data you need
- whether an ECR image is needed
- whether the cluster is needed for another project
- whether backups should be retained

Never delete production data just to reduce cost.

---

# 44. Complete deployment checklist

Use this checklist when setting up the project from scratch.

## Local setup

- [ ] Install Git
- [ ] Install AWS CLI
- [ ] Install kubectl
- [ ] Install Helm
- [ ] Install Docker
- [ ] Install Python
- [ ] Install Node/npm
- [ ] Configure AWS CLI
- [ ] Verify AWS identity

## AWS networking

- [ ] Create VPC
- [ ] Create two public subnets
- [ ] Create two private subnets
- [ ] Configure routing
- [ ] Configure DNS support
- [ ] Configure subnet tags if ALB will be used

## EKS

- [ ] Create EKS cluster
- [ ] Create cluster IAM role
- [ ] Create node IAM role
- [ ] Create two worker nodes
- [ ] Verify nodes are Ready
- [ ] Configure kubectl

## ECR

- [ ] Create `wlms-backend`
- [ ] Create `wlms-frontend`
- [ ] Verify repositories

## RDS

- [ ] Create PostgreSQL RDS
- [ ] Create private DB subnet group
- [ ] Disable public access
- [ ] Create RDS security group
- [ ] Allow EKS → RDS TCP 5432
- [ ] Initialize schema
- [ ] Verify database objects

## Kubernetes

- [ ] Create `wlms` namespace
- [ ] Create `wlms-backend-secrets`
- [ ] Review ConfigMap
- [ ] Review backend Deployment
- [ ] Review frontend Deployment
- [ ] Review Kustomization
- [ ] Decide whether public Ingress is required

## AWS Load Balancer Controller

Only if using public Ingress:

- [ ] Create EKS OIDC provider
- [ ] Create LBC IAM policy
- [ ] Create LBC IAM role
- [ ] Create service account
- [ ] Install controller with Helm
- [ ] Tag public subnets
- [ ] Verify controller Pods

## GitHub

- [ ] Push repository
- [ ] Create GitHub OIDC provider in AWS
- [ ] Create GitHub deployment IAM role
- [ ] Restrict trust to repository/branch
- [ ] Add ECR permissions
- [ ] Add `eks:DescribeCluster`
- [ ] Create EKS access entry
- [ ] Grant namespace-scoped edit access
- [ ] Add `AWS_REGION`
- [ ] Add `EKS_CLUSTER_NAME`
- [ ] Add `VITE_API_URL`
- [ ] Add `AWS_DEPLOY_ROLE_ARN`
- [ ] Verify workflow uses `id-token: write`

## CI/CD

- [ ] Run backend checks locally
- [ ] Run frontend checks locally
- [ ] Commit changes
- [ ] Push to `master`
- [ ] Open GitHub Actions
- [ ] Confirm backend checks pass
- [ ] Confirm frontend checks pass
- [ ] Confirm OIDC authentication succeeds
- [ ] Confirm ECR push succeeds
- [ ] Confirm EKS deployment succeeds
- [ ] Verify Pods
- [ ] Verify Services

## Public website, if required

- [ ] Request ACM certificate
- [ ] Validate certificate with DNS
- [ ] Configure `ingress.yaml`
- [ ] Add Ingress to Kustomization
- [ ] Deploy
- [ ] Get ALB hostname
- [ ] Create DNS aliases
- [ ] Verify HTTPS
- [ ] Verify frontend
- [ ] Verify API
- [ ] Verify CORS

---

# 45. Final expected result

For the private learning deployment, the final Kubernetes state should look approximately like:

```text
Namespace: wlms

Deployments:
    wlms-backend     2 replicas
    wlms-frontend    2 replicas

Services:
    wlms-backend     ClusterIP :8000
    wlms-frontend    ClusterIP :80

Secret:
    wlms-backend-secrets

ConfigMap:
    wlms-config

Database:
    Private PostgreSQL RDS
```

For the CI/CD pipeline:

```text
Developer
   |
   | git push origin master
   v
GitHub
   |
   v
GitHub Actions
   |
   +--> Ruff
   +--> pytest
   +--> frontend lint
   +--> frontend tests
   +--> frontend build
   |
   v
GitHub OIDC
   |
   v
AWS IAM
   |
   +--> ECR
   |      |
   |      +--> backend image
   |      +--> frontend image
   |
   v
EKS
   |
   +--> backend Deployment
   +--> frontend Deployment
   |
   v
Private RDS
```

For a public deployment:

```text
Internet
   |
   v
DNS
   |
   v
HTTPS / ACM
   |
   v
AWS ALB
   |
   v
EKS Services
   |
   +--> Frontend
   |
   +--> Backend
          |
          v
       Private RDS
```

The key principle is to keep application deployment automated while keeping infrastructure creation, database initialization, secrets, and public-network exposure as deliberate administrative operations.
