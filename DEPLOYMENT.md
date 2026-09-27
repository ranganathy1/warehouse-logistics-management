# GitHub and AWS deployment

This repository deploys the React app and FastAPI API to Amazon EKS. Images are stored in ECR, PostgreSQL runs separately on Amazon RDS, and the AWS Load Balancer Controller creates an internet-facing ALB for the Kubernetes Ingress. The workflow deploys commits pushed to `main`; pull requests run validation only.

## 1. Prepare AWS

Use one AWS region for EKS, ECR, the ALB, and the ACM certificate. Create:

- An EKS cluster with at least two worker nodes (or an equivalent managed node group) and `kubectl` access for an administrator.
- An EKS node IAM role with ECR image-pull permissions (such as `AmazonEC2ContainerRegistryPullOnly`) and network access from the cluster to RDS.
- Two private ECR repositories named `wlms-backend` and `wlms-frontend`.
- A PostgreSQL RDS instance. Restrict its security group to the EKS worker/pod network on TCP 5432; do not make the database public.
- A public ACM certificate for both `wlms.com` and `api.wlms.com`, validated through DNS.
- The AWS Load Balancer Controller installed in the cluster, with its IAM role/service account and subnet discovery tags configured according to the [AWS EKS guide](https://docs.aws.amazon.com/eks/latest/userguide/aws-load-balancer-controller.html). The public subnets need the appropriate ALB role tags, and the ALB must be able to reach the cluster targets.

Initialize the database once by connecting to the RDS instance and running these scripts in order: `SQL/Tables.sql`, `SQL/Triggers.sql`, `SQL/Views.sql`, `SQL/Procedures.sql`. Keep an encrypted backup and use a migration process for later schema changes; the app workflow does not run SQL migrations.

Configure the Ingress in `k8s/ingress.yaml`: replace both example hostnames and the certificate ARN with your values. Set `FRONTEND_ORIGINS` in `k8s/configmap.yaml` to the exact HTTPS frontend origin. The frontend URL must not include a trailing path; the API hostname is set separately as the GitHub Actions variable `VITE_API_URL`, for example `https://api.wlms.com`.

Create the namespace and runtime secret once, using an administrator context. Replace the values locally; do not commit them or paste them into workflow files:

```powershell
kubectl create namespace wlms
kubectl create secret generic wlms-backend-secrets -n wlms `
  --from-literal=DB_URL='postgresql://DB_USER:URL_ENCODED_PASSWORD@RDS_ENDPOINT:5432/DB_NAME' `
  --from-literal=JWT_SECRET_KEY='GENERATE_A_LONG_RANDOM_SECRET'
```

If the secret already exists, update it with the same command plus `--dry-run=client -o yaml | kubectl apply -f -`. URL-encode special characters in the database password. Protect Kubernetes secret access and enable EKS secret encryption with AWS KMS.

## 2. Configure GitHub

In the repository, add these **Actions variables** under **Settings → Secrets and variables → Actions → Variables**:

| Variable | Example |
| --- | --- |
| `AWS_REGION` | `us-east-1` |
| `EKS_CLUSTER_NAME` | Your EKS cluster name |
| `VITE_API_URL` | `https://api.wlms.com` |

Add this **Actions secret** under **Settings → Secrets and variables → Actions → Secrets**:

| Secret | Value |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | ARN of the IAM role configured for GitHub OIDC below |

Do not add `DB_URL` or `JWT_SECRET_KEY` to GitHub: they are provisioned directly as a Kubernetes Secret. Pull requests run Python Ruff and pytest plus frontend Oxlint, Vitest, and a production build. Deployment runs only on pushes to `main`, and only after both `backend-checks` and `frontend-checks` pass. Protect `main` with pull-request review and require both check jobs to pass.

## 3. Allow GitHub Actions to deploy

Create an IAM OIDC provider for `https://token.actions.githubusercontent.com` in the AWS account if one does not already exist. Create an IAM role whose trust policy restricts the subject to this repository and the `main` branch. Replace `AWS_ACCOUNT_ID` and `OWNER/REPOSITORY`:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::AWS_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike": { "token.actions.githubusercontent.com:sub": "repo:OWNER/REPOSITORY:ref:refs/heads/main" }
    }
  }]
}
```

Attach a least-privilege policy allowing ECR push operations on the two repositories (`ecr:GetAuthorizationToken` on `*`; `ecr:BatchCheckLayerAvailability`, `ecr:CompleteLayerUpload`, `ecr:InitiateLayerUpload`, `ecr:PutImage`, and `ecr:UploadLayerPart` on those repository ARNs) and `eks:DescribeCluster` on the target cluster. Set the role ARN as `AWS_DEPLOY_ROLE_ARN` in GitHub.

Add an EKS access entry for this IAM role, then grant it Kubernetes edit access to the `wlms` namespace (for example, the EKS `AmazonEKSEditPolicy` access policy scoped to that namespace). Create the namespace and initial secret before the first deployment. The workflow uses GitHub's OIDC short-lived credentials; do not create long-lived AWS access keys.

## 4. DNS and first deployment

After applying the manifests, get the Ingress address with `kubectl get ingress -n wlms`. Create DNS alias records for both hostnames pointing to the ALB. Push or merge to `main`; GitHub Actions builds and pushes SHA-tagged images, applies the manifests, and waits for both deployments to become ready. Verify with `kubectl get pods,services,ingress -n wlms` and browse `https://wlms.com`.

The first deployment requires all AWS prerequisites, the namespace and secret, and the hostname/certificate edits above. `VITE_API_URL` is compiled into the frontend image, so changing it requires another deployment. Never use `--reload` in the production API container.

## Run checks locally

From PowerShell, install the backend development tools and run its static analysis and unit tests:

```powershell
cd backend
python -m pip install -r requirements-dev.txt
ruff check .
python -m pytest -q
```

Run frontend validation from the frontend directory:

```powershell
cd wlms-frontend
npm ci
npm run lint
npm test
npm run build
```

Keep the test files in the repository and push them with the code. GitHub Actions checks them out and runs these commands; there is no separate test-file upload or manual test submission.