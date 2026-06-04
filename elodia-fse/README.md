# ElodiaTech FSE Manager

Application de gestion des rejets de Feuilles de Soins Électroniques (FSE) pour ElodiaTech, Martinique.

## Stack technique
- React 18 + TypeScript + Vite
- TailwindCSS v4
- Supabase (Auth + PostgreSQL)
- Recharts
- React Router v7

## Démarrage rapide

### 1. Installation
```bash
cd elodia-fse
npm install
```

### 2. Configuration de la base de données Supabase

#### Option A — Via le script automatique (nécessite la clé `service_role`)
```bash
# Récupérez votre clé service_role dans Supabase Dashboard → Settings → API
node setup-db.mjs <VOTRE_SERVICE_ROLE_KEY>
```

#### Option B — Manuellement via le Dashboard Supabase
1. Allez sur https://app.supabase.com/project/awyrojlanodjnuoepweq/sql/new
2. Copiez le contenu de `supabase/migrations/001_initial_schema.sql`
3. Exécutez le SQL
4. Lancez l'application — la page de setup permet de charger les données de démo

### 3. Lancement
```bash
npm run dev
```
Application disponible sur http://localhost:3000

## Comptes de démo (après setup)
| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Gérant | gerant@elodiatech.com | demo123456 |
| Manageuse | manageuse@elodiatech.com | demo123456 |
| Agent | agent1@elodiatech.com | demo123456 |

## Modules

1. **Dashboard Gérant** — KPIs, alertes CPE, graphiques CA et rejets
2. **Dashboard Agent** — Kanban 3 files (A/B/C), progression journalière
3. **Dashboard Manageuse** — Commissions, performance équipe
4. **Rejets FSE** — Tableau filtrable, drawer de traitement, ticket IA
5. **Médecins** — Grille cartes, fiche onglets, formulaire stepper
6. **Facturation** — 3 offres, simulateur interactif
7. **Commissions** — Calcul détaillé, historique 6 mois

## Formules commerciales

### ZEN FSE
```
SI rejets ≤ 40 → 99€
SINON → 99€ + PLAFOND((rejets-40)/40) × 40€
```

### LIBERTY FSE
```
Commission = montant_récupéré × 12%
```

### PASS RÉCUP'
```
< 20 000€ → 10% | ≥ 20 000€ → 12%
```

## Commission manageuse
```
rémunération_propre = montant_manageuse × 50%
commission_équipe = montant_agents_excl_manageuse × 5%
total = rémunération_propre + commission_équipe
```

## Supabase
- **URL** : https://awyrojlanodjnuoepweq.supabase.co
- **Clé publiable** : sb_publishable_wZNWqlN3gZM49B_O7UyYkQ_v5h8ieH6
