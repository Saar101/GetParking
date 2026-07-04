# GitHub Actions Setup

This repository already contains the workflows in `.github/workflows/ci.yml` and `.github/workflows/deploy.yml`.

This file captures the exact values that were verified from the current repository and Google Cloud project, so GitHub configuration can be completed without guessing.

## Repository

- GitHub repo: `Saar101/GetParking`

## Verified Production Infrastructure

- GCP project ID: `getparking-81f41`
- GCP project number: `179171539484`
- GCP region: `us-central1`
- Cloud Run service: `getparking-api`
- Cloud Run URL: `https://getparking-api-vgg57tm63a-uc.a.run.app`
- Firebase project ID: `getparking-81f41`
- Cloud Run runtime service account: `getparking-run-sa@getparking-81f41.iam.gserviceaccount.com`
- Secret Manager secret already present: `OPENAI_API_KEY`
- Workload identity pool: `projects/179171539484/locations/global/workloadIdentityPools/github-actions`
- Workload identity provider: `projects/179171539484/locations/global/workloadIdentityPools/github-actions/providers/github`
- Workload identity state: `ACTIVE`

## GitHub Repository Variables

Create these as GitHub Actions repository variables:

```text
GCP_PROJECT_ID=getparking-81f41
GCP_REGION=us-central1
CLOUD_RUN_SERVICE=getparking-api
FIREBASE_PROJECT_ID=getparking-81f41
OPENAI_MODEL=gpt-4o-mini

VITE_FIREBASE_AUTH_DOMAIN=getparking-81f41.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=getparking-81f41
VITE_FIREBASE_STORAGE_BUCKET=getparking-81f41.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=179171539484
VITE_FIREBASE_APP_ID=1:179171539484:web:e55e9777d90a7b726b3dd9
VITE_FIREBASE_MEASUREMENT_ID=G-MZ6YV657YY
VITE_PARKING_API_BASE_URL=https://getparking-api-vgg57tm63a-uc.a.run.app
```

## GitHub Repository Secrets

Create these as GitHub Actions repository secrets:

```text
VITE_FIREBASE_API_KEY=<your Firebase Web API key>
VITE_GOOGLE_MAPS_API_KEY=<your Google Maps JavaScript API key>
FIREBASE_TOKEN=<firebase login:ci token>
GCP_WORKLOAD_IDENTITY_PROVIDER=projects/179171539484/locations/global/workloadIdentityPools/github-actions/providers/github
GCP_SERVICE_ACCOUNT=getparking-run-sa@getparking-81f41.iam.gserviceaccount.com
```

Notes:

- `VITE_FIREBASE_API_KEY` is public in the browser bundle, but keep it as a GitHub secret so it does not need to live in the workflow file.
- The deploy workflow currently uses `FIREBASE_TOKEN` for the Firebase Hosting step.

## Workload Identity Federation

The workload identity pool and provider have already been created and verified in the target project.

Current provider secret value:

```text
GCP_WORKLOAD_IDENTITY_PROVIDER=projects/179171539484/locations/global/workloadIdentityPools/github-actions/providers/github
```

If you need to recreate them later, use the commands below.

Run these commands locally with `gcloud` authenticated to the `getparking-81f41` project:

```powershell
& "C:\Users\User\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" iam workload-identity-pools create github-actions `
  --project=getparking-81f41 `
  --location=global `
  --display-name="GitHub Actions"

& "C:\Users\User\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" iam workload-identity-pools providers create-oidc github `
  --project=getparking-81f41 `
  --location=global `
  --workload-identity-pool=github-actions `
  --display-name="GitHub OIDC" `
  --issuer-uri="https://token.actions.githubusercontent.com" `
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" `
  --attribute-condition="assertion.repository=='Saar101/GetParking'"

& "C:\Users\User\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" iam service-accounts add-iam-policy-binding getparking-run-sa@getparking-81f41.iam.gserviceaccount.com `
  --project=getparking-81f41 `
  --role="roles/iam.workloadIdentityUser" `
  --member="principalSet://iam.googleapis.com/projects/179171539484/locations/global/workloadIdentityPools/github-actions/attribute.repository/Saar101/GetParking"
```

Set this GitHub secret exactly:

```text
GCP_WORKLOAD_IDENTITY_PROVIDER=projects/179171539484/locations/global/workloadIdentityPools/github-actions/providers/github
```

## IAM Status

The current Cloud Run runtime service account is already configured for GitHub deployment and was verified with these roles:

- `roles/run.admin`
- `roles/iam.serviceAccountUser`
- `roles/cloudbuild.builds.editor`

It also already trusts the GitHub repository principal:

- `principalSet://iam.googleapis.com/projects/179171539484/locations/global/workloadIdentityPools/github-actions/attribute.repository/Saar101/GetParking`

If you prefer not to reuse the runtime service account for deployment in the future, create a dedicated service account such as `github-actions-deploy@getparking-81f41.iam.gserviceaccount.com`, grant those roles to it, and then use that email in `GCP_SERVICE_ACCOUNT` instead.

## Firebase Token

Generate the Firebase token locally:

```powershell
firebase login:ci
```

Copy the returned token into the `FIREBASE_TOKEN` GitHub secret.

## Validation Order

1. Add the GitHub variables and secrets listed above.
2. Generate a Firebase token with `firebase login:ci` and store it in `FIREBASE_TOKEN`.
3. Push the current branch or run the CI workflow manually.
4. Run `Deploy Production` with `workflow_dispatch`.
5. Verify `/health` on Cloud Run and then verify the hosted frontend login and recommendation flow.