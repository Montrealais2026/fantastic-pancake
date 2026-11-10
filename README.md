# fantastic-pancake
Voici la description de mon tout premier dépôt du cours INF1410 Introduction au génie logiciel.

Je vais utiliser cet espace "Readme.md" pour y développer les différents éléments demandés dans le Jalon 1.

Voici les livrables demandés dans le Jalon 1: 
-Un dépôt GitHub contenant un README.md avec la vision client : qui est l’utilisateur, quel problème l’application résout, et quelle est la solution envisagée (environ une page, rédigée du point de vue de l’utilisateur)
-Un ensemble de user stories sous forme de GitHub Issues, traduisant cette vision en tâches concrètes (avec des labels appropriés)
(équipe) Un tableau GitHub Projects initialisé avec ces issues en backlog
-Un fichier .github/workflows/ci.yml configurant une pipeline CI qui exécute automatiquement la suite de tests à chaque push
-Un ensemble de tests automatisés couvrant les fonctionnalités déjà implantées
-Une première entrée dans votre blogue technique, répondant aux questions suivantes : qui sont vos utilisateurs et quel problème résolvez-vous ? Quels sont vos premiers choix techniques (langage, framework, hébergement) et quelles alternatives avez-vous considérées ? Qu’est-ce qui est encore incertain à ce stade ?

Voici ci-après la vision client : 
Le client est un restaurateur / responsable d'un restaurant.
Les restaurants font face depuis plusieurs années à une recrudescence des clients qui, après avoir fait une réservation, ne se présentent pas à leurs rendez-vous, annulent à la dernière minute ou n'honorent pas leurs réservations.
C'est un grave problème pour les restaurateurs, qui perdent beaucoup d'argent à cause de ce comportement irresponsable de la part des clients "no-show".
Pire : ils n'ont aucun moyen de s'organiser : ils ne savent pas qui ne s'est pas présenté, combien de fois il l'a fait, ni quels créneaux sont les plus à risque.
La liste de réservations vit dans un logiciel de réservation, mais ce logiciel ne dit rien sur le client lui-même : est-il venue la semaine dernière ? A-t-il déjà fait faux bond deux fois ? Est-ce que le restaurateur devrait lui demander une carte pour garantir la réservation ?

Ci-après quelques articles qui dénoncent cette situation : 
https://www.lapresse.ca/affaires/2025-07-17/les-restaurateurs-peuvent-imposer-des-penalites-pour-les-reservations-fantomes.php
https://ici.radio-canada.ca/nouvelle/2038119/reservation-annulation-avertissement-restaurateur
https://www.journaldequebec.com/2022/12/17/reservations-des-annulations-insultantes-pour-les-restaurateurs

Comment aider les restaurants à lutter contre ce fléau ?
Grâce à notre application!

Notre application/logiciel va permettre les avancées suivantes :
- Une connexion facile : depuis un téléphone ou un ordinateur. Pas de configuration complexe.
- Une connexion automatique aux logiciels de réservation des restaurants.
- Une fiche client lisible en quelques instants : historique des visites et surtout son taux de "no-show".
- Une façon simple de renseigner si un client a fait un "no-show" dans le système.

Etant donné que le système est alimenté par les autres restaurateurs (application collaborative), il est possible pour tous les restaurants dans le monde d'être abonnné à ce logiciel qui se met à jour automatiquement.

Pourquoi les restaurateurs payeraient pour ça ? 
- Car cela va leur permettre d'anticiper les no-shows
- Cela va leur permettre de gagner plus d'argent en bout de ligne.
