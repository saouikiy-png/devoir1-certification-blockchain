# Système de certification académique sur blockchain

Application de démonstration pour émettre des certificats académiques vérifiables sur un registre Ethereum local. Le dépôt comprend un smart contract Solidity, ses tests Hardhat, un frontend React, l’import Excel/CSV et des fichiers de démonstration. La cible de ce projet est exclusivement le réseau local Hardhat (chain ID `31337`).

## Architecture

- `contracts/CertificateRegistry.sol` : registre, rôles owner/admin, émission individuelle/en lot, unicité des identifiants étudiants et révocation.
- `test/CertificateRegistry.test.ts` : tests de permissions, événements, lecture, erreurs, batch et mesure de gas.
- `scripts/deploy.ts` : déploiement et génération de l’adresse/ABI consommées par le frontend.
- `scripts/generate-sample-xlsx.ts` : génération des classeurs d’exemple.
- `frontend/` : interface React/Vite, wagmi/viem et SheetJS.
- `sample-data/` : classeurs valides et invalides générés par le script.
- `screenshots/` : emplacement des captures d’écran à ajouter manuellement.

## Prérequis

- Node.js 20 ou plus récent et npm.
- MetaMask pour les opérations d’administration.
- Le réseau local Hardhat doit être actif sur `http://127.0.0.1:8545`.

## Installation

Depuis la racine du dépôt :

```powershell
npm install
cd frontend
npm install
cd ..
```

Les fichiers Excel sont générés avec :

```powershell
npm run sample-data
```

Le script produit `sample-data/etudiants.xlsx` (12 lignes) et `sample-data/etudiants-invalide.xlsx` (champs manquants, date/adresse invalides et doublon).

## Démarrage local

Ouvrez trois terminaux à la racine du projet.

1. Démarrez le nœud :

   ```powershell
   npx hardhat node
   ```

2. Déployez le contrat et générez son adresse ainsi que son ABI dans `frontend/src/contracts/CertificateRegistry.json` :

   ```powershell
   npx hardhat run scripts/deploy.ts --network localhost
   ```

   Sur un nœud Hardhat neuf, l’adresse du premier déploiement est généralement `0x5FbDB2315678afecb367f032d93F642f64180aa3`. L’adresse réellement affichée par le script est la référence pour votre session locale. Elle n’est pas persistante après redémarrage du nœud.

3. Lancez l’interface :

   ```powershell
   cd frontend
   npm run dev
   ```

   Ouvrez l’URL Vite indiquée dans le terminal (généralement `http://localhost:5173`).

## Configuration MetaMask

Ajoutez un réseau avec les paramètres suivants :

| Paramètre | Valeur |
| --- | --- |
| Nom | Hardhat Local |
| URL RPC | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Devise | `ETH` |

Importez dans MetaMask un compte de test affiché par `npx hardhat node`. Les clés affichées par Hardhat sont des clés de développement locales exclusivement : ne les utilisez jamais sur un réseau réel et ne les ajoutez pas au dépôt. L’application ne contient ni clé privée ni secret.

Le compte de déploiement (premier compte Hardhat) est l’owner et administrateur initial. Seul l’owner peut autoriser ou retirer des admins via le contrat. La zone d’administration vérifie le rôle on-chain avant d’activer l’émission.

## Utilisation

### Émission d’un certificat

Dans **Administration**, connectez MetaMask au réseau Hardhat Local, puis renseignez le nom, l’identifiant étudiant, le diplôme, la date ISO et la mention. L’adresse de destinataire est facultative dans l’interface : si elle est vide, le certificat est attribué au compte administrateur connecté. Le contrat refuse l’adresse nulle. Signez la transaction dans MetaMask ; son hash, son statut et le ou les identifiants créés sont affichés.

### Import Excel ou CSV

Chargez un fichier `.xlsx`, `.xls` ou `.csv`. L’interface contrôle les colonnes attendues, les champs obligatoires, le format de date, les adresses fournies et les doublons locaux/on-chain avant de proposer l’émission. Les lignes invalides ne peuvent pas être sélectionnées. Choisissez le mode unitaire ou le mode par lots (taille réglable de 5, 10 ou 15), puis émettez les lignes sélectionnées. Chaque transaction est suivie séparément.

La ligne d’en-tête doit contenir exactement ces noms de colonnes (l’ordre peut varier) :

`studentName | studentId | diplomaTitle | issueDate | recipientAddress | grade`

`studentId` est unique (par exemple `2023-INF-042`), `issueDate` suit `YYYY-MM-DD`; `recipientAddress` peut être vide et `grade` peut contenir `Passable`, `Assez Bien`, `Bien` ou `Très Bien`. Les quatre champs obligatoires du contrat sont le nom, l’identifiant, le diplôme et la date. Les tests de format ont lieu dans l’interface ; le contrat garantit en plus les champs obligatoires et l’unicité des identifiants.

### Vérification publique

La page **Vérifier** fonctionne sans wallet connecté. Saisissez l’identifiant numérique du certificat pour afficher ses informations, son destinataire et son statut valide/révoqué. La lecture se fait via le nœud local.

## Tests, compilation et gas

```powershell
npx hardhat compile
npx hardhat test
```

Avec Hardhat `2.22.17`, Solidity `0.8.24` (optimiseur activé, 200 runs, viaIR), les tests ont mesuré :

| Taille du lot | Gas utilisé |
| ---: | ---: |
| 5 | 903 274 |
| 10 | 1 741 043 |
| 15 | 2 596 078 |

Les tests rapportent ces mesures dans leur sortie ; elles peuvent varier si les paramètres de compilation sont modifiés.

Build frontend :

```powershell
cd frontend
npm run build
```

## Adresse du contrat local

Le déploiement local vérifié pour ce dépôt a créé le contrat à `0x5FbDB2315678afecb367f032d93F642f64180aa3`. Le script affiche et écrit l’adresse effective dans `frontend/src/contracts/CertificateRegistry.json`. Sur un nœud Hardhat neuf, le premier déploiement est généralement à cette adresse. Toute nouvelle session de nœud doit être redéployée ; vérifiez alors l’adresse indiquée dans le fichier généré.

## Captures d’écran

Le dossier `screenshots/` est prêt à recevoir les captures suivantes :

- émission réussie, avec hash de transaction ;
- aperçu d’import Excel et validations ;
- page de vérification publique d’un certificat.

Ces captures doivent être prises après démarrage du nœud, déploiement, et connexion de MetaMask.

## Limites et améliorations possibles

- La blockchain est locale : les données et le contrat ne sont pas persistants après arrêt du nœud.
- Les fichiers sont analysés côté client et ne sont pas conservés.
- Les frais et limites de lot ne sont pas calibrés pour un réseau public.
- Pour la production : audit indépendant du contrat, contrôle renforcé des rôles, tests multi-navigateurs, hébergement résilient et stratégie de confidentialité (les données des certificats sont publiques).

## Optionnel : Sepolia

Sepolia n’est pas configuré dans ce projet. Pour une évolution, il faudra ajouter le réseau et une gestion de configuration dédiée, utiliser un wallet de test sécurisé et ne jamais versionner de clé privée ou de fichier `.env` contenant un secret.
