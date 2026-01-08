# Configuration DNS Anti-Spam pour R'MouV

## 🎯 Objectif

Configurer les enregistrements DNS (SPF, DKIM, DMARC) chez OVH pour éviter que les emails de confirmation arrivent dans les spams.

## 📋 Prérequis

- Accès à l'interface de gestion DNS d'OVH
- Domaine `rmouv.fr` hébergé chez OVH
- Email `contact1@rmouv.fr` configuré dans OVH/Zimbra

## 🔧 Configuration des Enregistrements DNS

### 1. Accéder à la Gestion DNS OVH

1. Connectez-vous à votre espace client OVH : https://www.ovh.com/manager/
2. Allez dans **Web Cloud** → **Noms de domaine**
3. Cliquez sur votre domaine `rmouv.fr`
4. Allez dans l'onglet **Zone DNS**

### 2. Configuration SPF (Sender Policy Framework)

**Objectif** : Autoriser OVH à envoyer des emails pour votre domaine.

#### Étape 1 : Vérifier s'il existe déjà un enregistrement SPF

1. Dans la zone DNS, recherchez un enregistrement de type **TXT** avec le nom `@` ou `rmouv.fr`
2. Si un enregistrement SPF existe déjà, vous devez le modifier (un seul enregistrement SPF par domaine)

#### Étape 2 : Créer ou Modifier l'enregistrement SPF

1. Cliquez sur **Ajouter une entrée** ou **Modifier** si un enregistrement existe
2. Configurez :
   - **Type** : `TXT`
   - **Sous-domaine** : `@` (ou laissez vide selon l'interface OVH)
   - **Valeur** : `v=spf1 include:mx.ovh.com ~all`
   - **TTL** : `3600` (par défaut)

**Explication de la valeur SPF :**
- `v=spf1` : Version du protocole SPF
- `include:mx.ovh.com` : Autorise les serveurs OVH à envoyer des emails
- `~all` : Soft fail pour les autres serveurs (recommandé pour commencer)

**Alternative plus stricte (si vous êtes sûr) :**
- `v=spf1 include:mx.ovh.com -all` (hard fail, plus strict)

3. Cliquez sur **Valider** ou **Enregistrer**

### 3. Configuration DKIM (DomainKeys Identified Mail)

**Objectif** : Signer numériquement vos emails pour prouver leur authenticité.

#### Étape 1 : Récupérer les clés DKIM depuis OVH

1. Dans l'espace client OVH, allez dans **Web Cloud** → **Emails** (ou **Zimbra Mail**)
2. Sélectionnez votre domaine `rmouv.fr`
3. Cherchez la section **DKIM** ou **Authentification email**
4. OVH devrait afficher :
   - Une clé publique DKIM (à ajouter dans DNS)
   - Un sélecteur (généralement `default` ou `ovh`)

#### Étape 2 : Ajouter l'enregistrement DKIM dans la Zone DNS

1. Dans la **Zone DNS**, cliquez sur **Ajouter une entrée**
2. Configurez :
   - **Type** : `TXT`
   - **Sous-domaine** : `default._domainkey` (ou `ovh._domainkey` selon le sélecteur OVH)
   - **Valeur** : La clé publique fournie par OVH (commence généralement par `v=DKIM1; k=rsa; p=...`)
   - **TTL** : `3600`

**Format typique de la valeur DKIM :**
```
v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...
```

3. Cliquez sur **Valider**

**Note** : Si OVH ne fournit pas directement les clés DKIM, contactez le support OVH pour les obtenir.

### 4. Configuration DMARC (Domain-based Message Authentication)

**Objectif** : Définir la politique de gestion des emails non authentifiés.

#### Étape 1 : Créer l'enregistrement DMARC

1. Dans la **Zone DNS**, cliquez sur **Ajouter une entrée**
2. Configurez :
   - **Type** : `TXT`
   - **Sous-domaine** : `_dmarc`
   - **Valeur** : `v=DMARC1; p=quarantine; rua=mailto:contact1@rmouv.fr; ruf=mailto:contact1@rmouv.fr; pct=100`
   - **TTL** : `3600`

**Explication de la valeur DMARC :**
- `v=DMARC1` : Version du protocole DMARC
- `p=quarantine` : Mettre en quarantaine (spam) les emails non authentifiés
  - Alternatives : `p=none` (ne rien faire, pour tester), `p=reject` (rejeter complètement)
- `rua=mailto:contact1@rmouv.fr` : Adresse pour recevoir les rapports agrégés
- `ruf=mailto:contact1@rmouv.fr` : Adresse pour recevoir les rapports de défaillance
- `pct=100` : Appliquer la politique à 100% des emails

**Politique recommandée pour commencer (moins stricte) :**
```
v=DMARC1; p=none; rua=mailto:contact1@rmouv.fr; pct=100
```
Cette politique permet de recevoir des rapports sans bloquer les emails.

**Politique stricte (après vérification que tout fonctionne) :**
```
v=DMARC1; p=reject; rua=mailto:contact1@rmouv.fr; ruf=mailto:contact1@rmouv.fr; pct=100
```

3. Cliquez sur **Valider**

## ⏱️ Propagation DNS

Après avoir ajouté/modifié les enregistrements DNS :

1. **Délai de propagation** : 15 minutes à 48 heures (généralement 1-2 heures)
2. **Vérification** : Utilisez des outils en ligne pour vérifier que les enregistrements sont bien propagés :
   - **SPF** : https://mxtoolbox.com/spf.aspx
   - **DKIM** : https://mxtoolbox.com/dkim.aspx
   - **DMARC** : https://mxtoolbox.com/dmarc.aspx

## 🧪 Vérification de la Configuration

### Outils de Test en Ligne

1. **MXToolbox** : https://mxtoolbox.com/
   - Testez SPF, DKIM, DMARC
   - Entrez votre domaine `rmouv.fr`

2. **Mail-Tester** : https://www.mail-tester.com/
   - Envoyez un email à l'adresse fournie
   - Obtenez un score de délivrabilité

3. **Google Postmaster Tools** : https://postmaster.google.com/
   - Surveillez la réputation de votre domaine
   - Vérifiez les statistiques de délivrabilité

### Test Manuel

1. Créez un compte de test via votre formulaire d'inscription
2. Vérifiez que l'email arrive dans la boîte de réception (pas dans les spams)
3. Vérifiez les en-têtes de l'email pour confirmer SPF, DKIM, DMARC :
   - Dans Gmail : Cliquez sur les 3 points → "Afficher l'original"
   - Cherchez les lignes `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`

## 📊 Résumé des Enregistrements à Ajouter

| Type | Sous-domaine | Valeur | Description |
|------|--------------|--------|-------------|
| TXT | `@` | `v=spf1 include:mx.ovh.com ~all` | SPF - Autorise OVH |
| TXT | `default._domainkey` | `v=DKIM1; k=rsa; p=...` | DKIM - Clé fournie par OVH |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:contact1@rmouv.fr; pct=100` | DMARC - Politique |

## ⚠️ Notes Importantes

1. **Un seul enregistrement SPF** : Ne créez qu'un seul enregistrement SPF pour votre domaine
2. **Clés DKIM** : Si OVH ne fournit pas les clés DKIM directement, contactez le support
3. **DMARC progressif** : Commencez avec `p=none`, puis passez à `p=quarantine`, puis `p=reject` une fois que tout fonctionne
4. **Propagation** : Attendez la propagation DNS avant de tester (1-2 heures minimum)

## 🆘 En Cas de Problème

### Les emails arrivent toujours en spam

1. Vérifiez que les enregistrements DNS sont bien propagés (utilisez MXToolbox)
2. Vérifiez que les enregistrements sont corrects (pas d'erreur de syntaxe)
3. Attendez 24-48 heures pour que la réputation s'améliore
4. Demandez aux utilisateurs d'ajouter `contact1@rmouv.fr` à leurs contacts

### Erreur "Multiple SPF records"

- Vous ne pouvez avoir qu'un seul enregistrement SPF
- Supprimez les doublons et gardez un seul enregistrement

### DKIM ne fonctionne pas

- Vérifiez que le sélecteur dans DNS correspond à celui utilisé par OVH
- Contactez le support OVH pour obtenir les bonnes clés DKIM

---

**Date de création** : 6 décembre 2025  
**Domaine** : rmouv.fr  
**Email expéditeur** : contact1@rmouv.fr







