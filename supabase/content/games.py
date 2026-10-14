"""Canonical game content for the seeded catalogue.

Single source of truth: supabase/gen_games.py turns this into both
  - supabase/migrations/0003_seed_games.sql  (the real catalogue)
  - src/lib/sampleGames.ts                   (the no-backend fallback)
so the two can never drift. Edit here, then run `python3 supabase/gen_games.py`.

Rules written from scratch for this repo — never pasted from another site, per the
copyright rule in docs/product-spec.md §3.5.

Ratings are deliberately absent: inventing stars for a game nobody has rated is
fake social proof, and the UI hides the rating when the count is zero.
"""

GAMES: list[dict] = [
    dict(
        slug="brisca",
        title="Brisca",
        tagline="El juego de bazas más fácil de enseñar en un minuto.",
        summary="Un juego de bazas con triunfo para dos a cuatro personas. Se roba una carta "
                "después de cada baza, así que la mano se repone sola hasta que se acaba el "
                "mazo. Gana quien reúna más puntos en cartas.",
        players=(2, 4), best=2, teams=2,
        decks=[dict(slug="espanola-40", quantity=1)],
        missing="strict",
        missing_note="Los 120 puntos dependen de que estén las cuarenta cartas. Si falta una "
                     "figura, la cuenta final deja de cuadrar.",
        duration=(10, 20), complexity=1, age_min=6,
        extras=[], mechanics=["bazas", "triunfo"], adult=False,
        sections=[
            ("Objetivo",
             "Ganar bazas que contengan cartas de valor. Hay 120 puntos en la baraja; gana "
             "quien pase de 60."),
            ("Preparación",
             "Reparte tres cartas a cada jugador. Pon el resto en el centro boca abajo y "
             "levanta la carta de arriba, medio asomada bajo el mazo: su palo es el "
             "**triunfo** durante toda la partida."),
            ("Valor de las cartas",
             "- As: 11 puntos\n- Tres: 10 puntos\n- Rey: 4 puntos\n- Caballo: 3 puntos\n"
             "- Sota: 2 puntos\n- Siete, seis, cinco, cuatro y dos: 0 puntos\n\n"
             "Dentro de un palo, el orden de fuerza es: as, tres, rey, caballo, sota, siete, "
             "seis, cinco, cuatro, dos."),
            ("Desarrollo",
             "Sale el jugador a la derecha de quien repartió. Cada uno echa una carta; no "
             "hace falta seguir el palo ni asistir. Gana la baza la carta más alta del palo "
             "de triunfo y, si no hay triunfos, la más alta del palo de salida. Quien gana "
             "la baza se la queda, roba primero y sale en la siguiente."),
            ("Puntuación",
             "Al acabar las cartas, cada jugador suma los puntos de las cartas que ha ganado. "
             "Con 60 puntos hay empate; con más, victoria. Por parejas, se suman los puntos "
             "de los dos miembros."),
            ("Variantes",
             "- **Cambiar el siete**: quien tenga el siete del palo de triunfo puede cambiarlo "
             "por la carta de triunfo descubierta, si ésta es una figura.\n"
             "- **Por parejas**: con cuatro jugadores, los que se sientan enfrente son "
             "compañeros."),
        ],
    ),
    dict(
        slug="chinchon",
        title="Chinchón",
        tagline="Ligar grupos y escaleras antes de que te pillen con cartas en la mano.",
        summary="Cada jugador roba y descarta buscando grupos de cartas iguales y escaleras "
                "del mismo palo. Quien cierra deja a los demás con puntos en la mano, y se "
                "juega hasta que alguien se pasa del límite acordado.",
        players=(2, 6), best=4, teams=None,
        decks=[dict(slug="espanola-40", quantity=1)],
        missing="strict",
        missing_note="Las escaleras necesitan que no falte ninguna carta del palo: sin el "
                     "cinco de copas, media baraja deja de ligar.",
        duration=(20, 45), complexity=2, age_min=8,
        extras=["papel y lápiz"], mechanics=["ligar", "descarte"], adult=False,
        sections=[
            ("Objetivo",
             "Ligar las siete cartas de la mano en grupos y escaleras y cerrar la ronda. Los "
             "demás suman los puntos que les queden sin ligar; se elimina quien llegue a 100."),
            ("Preparación",
             "Reparte siete cartas a cada jugador. El resto va al centro boca abajo y se "
             "voltea la primera para empezar el montón de descartes."),
            ("Desarrollo",
             "En tu turno robas una carta —del mazo o la de arriba del descarte— y descartas "
             "otra, siempre quedándote con siete. Un **grupo** son tres o cuatro cartas del "
             "mismo número; una **escalera** son tres o más cartas seguidas del mismo palo. "
             "En la escalera, el orden es 1-2-3-4-5-6-7-sota-caballo-rey."),
            ("Cerrar",
             "Puedes cortar cuando al descartar te quede todo ligado, o te quede una sola "
             "carta suelta de cinco puntos o menos. Descarta boca abajo y anuncia el corte. "
             "Un **chinchón** —las siete cartas en una escalera del mismo palo— gana la "
             "partida entera en el acto."),
            ("Puntuación",
             "Cada jugador suma lo que le queda sin ligar: as 1 punto, del dos al siete su "
             "número, y sota, caballo y rey 10 cada una. Quien cortó suma 0, o -10 si cerró "
             "con todo ligado. Se anota por rondas hasta que alguien pasa de 100 y queda "
             "eliminado."),
            ("Variantes",
             "- **Con comodines**: se añaden dos comodines que valen por cualquier carta y "
             "puntúan 25 si te quedan en la mano.\n"
             "- **Reengancharse**: quien se elimina puede volver a entrar con los puntos del "
             "jugador que vaya peor, una sola vez."),
        ],
    ),
    dict(
        slug="escoba",
        title="Escoba de 15",
        tagline="Sumar quince y barrer la mesa.",
        summary="Se capturan cartas de la mesa sumando exactamente quince con una de la mano. "
                "Limpiar la mesa entera es una escoba y vale un punto. Juego corto, "
                "aritmética sencilla y mucha memoria.",
        players=(2, 4), best=2, teams=2,
        decks=[dict(slug="espanola-40", quantity=1)],
        missing="strict",
        missing_note="La cuenta de oros y de sietes decide la partida: si falta un oro, el "
                     "recuento final no sirve.",
        duration=(15, 30), complexity=2, age_min=7,
        extras=["papel y lápiz"], mechanics=["capturar", "aritmética", "memoria"], adult=False,
        sections=[
            ("Objetivo",
             "Capturar cartas sumando quince, y en particular los oros y el siete de oros. "
             "Se juega a 21 puntos."),
            ("Preparación",
             "Se juega con 40 cartas: si usas baraja de 48, quita los ochos y los nueves. "
             "Reparte tres cartas a cada jugador y pon cuatro boca arriba en la mesa. Si en "
             "la mesa inicial hay tres cartas que sumen quince, se vuelve a repartir."),
            ("Valor de las cartas",
             "As 1, dos a siete su número, sota 8, caballo 9 y rey 10."),
            ("Desarrollo",
             "En tu turno echas una carta. Si con una o varias cartas de la mesa suma "
             "exactamente quince, te las llevas todas junto con la tuya. Si no suma quince, "
             "la carta se queda en la mesa. Cuando se agotan las manos se reparten tres más, "
             "sin añadir cartas a la mesa, hasta acabar el mazo."),
            ("Escoba",
             "Si tu captura deja la mesa vacía, es **escoba**: un punto, y se anota aparte. "
             "Las cartas que queden en la mesa al final se las lleva quien hizo la última "
             "captura."),
            ("Puntuación",
             "Cada escoba vale 1 punto. Además: 1 punto por tener más cartas, 1 por tener más "
             "oros, 1 por el siete de oros (el *velo*) y 1 por tener más sietes. Se juega "
             "hasta 21."),
        ],
    ),
    dict(
        slug="texas-holdem",
        title="Póker Texas hold’em",
        tagline="Dos cartas tapadas, cinco en el centro, cuatro rondas de apuestas.",
        summary="La variante de póker más jugada. Cada jugador recibe dos cartas propias y "
                "comparte cinco comunitarias; se apuesta en cuatro rondas y gana la mejor "
                "mano de cinco cartas, o quien consiga que los demás se retiren.",
        players=(2, 10), best=6, teams=None,
        decks=[dict(slug="francesa-52", quantity=1)],
        missing="strict",
        missing_note="Las probabilidades que hacen justo el juego dependen de las 52 cartas "
                     "exactas.",
        duration=(30, 180), complexity=3, age_min=18,
        extras=["fichas"], mechanics=["apuestas", "faroleo", "manos"], adult=True,
        sections=[
            ("Objetivo",
             "Ganar el bote, bien con la mejor combinación de cinco cartas, bien haciendo que "
             "todos los demás abandonen la mano."),
            ("Preparación",
             "Hacen falta fichas y un botón que marque quién reparte. Los dos jugadores a la "
             "izquierda del botón ponen la ciega pequeña y la ciega grande antes de ver sus "
             "cartas."),
            ("Desarrollo",
             "Cada jugador recibe dos cartas tapadas y se apuesta. Después se descubren tres "
             "cartas comunitarias (**flop**) y se apuesta; una cuarta (**turn**) y se "
             "apuesta; una quinta (**river**) y se apuesta por última vez. En cada ronda "
             "puedes pasar, apostar, igualar, subir o retirarte."),
            ("Orden de las manos",
             "De mayor a menor: escalera de color, póker, full, color, escalera, trío, doble "
             "pareja, pareja, carta alta. Cada jugador forma su mejor mano de cinco cartas "
             "combinando las dos suyas con las cinco del centro."),
            ("Fin de la mano",
             "Si quedan dos o más jugadores tras la última apuesta, se descubren las cartas y "
             "gana la mejor mano. El botón pasa al jugador de la izquierda y empieza otra "
             "mano."),
            ("Juego responsable",
             "Si se juega con dinero, acordad antes el límite de la mesa y respetadlo. No es "
             "un juego para menores."),
        ],
    ),
]

# --- Los clásicos ----------------------------------------------------------

GAMES += [
    dict(
        slug="mus",
        title="Mus",
        tagline="Cuatro apuestas, una pareja y señas por debajo de la mesa.",
        summary="El juego de apuestas español por excelencia, en parejas. No gana la mejor "
                "mano, gana quien mejor apuesta: se puja cuatro veces por mano y se puede "
                "ganar un lance con las peores cartas si el rival no te aguanta. Los "
                "compañeros se avisan con señas, y eso es parte del juego.",
        players=(4, 4), best=4, teams=2,
        decks=[dict(slug="espanola-40", quantity=1)],
        missing="strict",
        missing_note="Grande, chica, pares y juego se cuentan sobre las cuarenta cartas "
                     "exactas. Si falta una, los cálculos de toda la mesa dejan de valer.",
        duration=(20, 60), complexity=5, age_min=12,
        extras=["fichas o garbanzos para el tanteo"],
        mechanics=["apuestas", "faroleo", "parejas", "señas"], adult=False,
        sections=[
            ("Objetivo",
             "Llegar a 40 piedras antes que la pareja contraria, ganando las apuestas de los "
             "cuatro lances de cada mano. Ojo: se gana apostando, no teniendo buenas cartas."),
            ("Preparación",
             "Cuatro jugadores en dos parejas, cada uno enfrente de su compañero. Baraja de "
             "40 cartas y cuatro cartas a cada jugador. Hacen falta fichas para contar: cada "
             "ficha es una **piedra**, cinco piedras son un **amarreco** y ocho amarrecos "
             "(40 piedras) son una partida."),
            ("Valor de las cartas",
             "Los **tres** valen como reyes y los **dos** valen como ases. Para grande y "
             "chica el orden de fuerza es: rey (y tres), caballo, sota, siete, seis, cinco, "
             "cuatro, as (y dos).\n\n"
             "Para el lance de juego: rey, tres, caballo y sota valen 10; el siete, seis, "
             "cinco y cuatro su número; el as y el dos valen 1."),
            ("El mus: cambiar cartas",
             "Antes de apostar, por turno, cada jugador dice **mus** si quiere cambiar "
             "cartas. Si los cuatro dicen mus, cada uno descarta las que quiera y roba otras "
             "tantas. Se repite mientras los cuatro acepten. En cuanto alguien dice **no hay "
             "mus**, se cortan las cartas y empiezan los lances."),
            ("Los cuatro lances",
             "Se juegan siempre en este orden:\n\n"
             "- **Grande**: quién tiene las cartas más altas.\n"
             "- **Chica**: quién tiene las cartas más bajas.\n"
             "- **Pares**: solo juegan quienes tengan parejas. Una pareja son *pares "
             "simples*, un trío son *medias*, y dos parejas o cuatro cartas iguales son "
             "*duples*.\n"
             "- **Juego**: solo juegan quienes sumen 31 o más. El mejor juego es el 31, "
             "después el 32, y luego 40, 37, 36, 35, 34 y 33. Si nadie llega a 31, se "
             "disputa el **punto**: gana la suma más alta por debajo de 31."),
            ("Cómo se apuesta",
             "En cada lance, por turno, puedes **pasar**, **envidar** (apostar dos piedras, "
             "y el rival puede subir) o cantar **órdago** (apostar la partida entera). Si el "
             "rival no quiere la apuesta, quien apostó se lleva una piedra y el lance se "
             "acaba ahí sin enseñar cartas. Si la quiere, el lance se resuelve al final de "
             "la mano, al descubrir."),
            ("Puntuación",
             "Al acabar la mano se cobran los lances ganados: grande 1 piedra, chica 1, y "
             "además lo apostado. En pares se cobra según lo que tengas: pares simples 1, "
             "medias 2, duples 3. En juego se cobran 2, o 3 si era 31. El punto paga 1.\n\n"
             "Quien llega a 40 piedras gana la partida. Se suele jugar al mejor de tres."),
            ("Las señas",
             "Los compañeros se avisan de lo que llevan con gestos acordados: morderse el "
             "labio son duples, guiñar un ojo son dos reyes, sacar la punta de la lengua son "
             "dos ases, levantar las cejas es juego. Hacer señas es legal; lo que no vale es "
             "hablar. Si la pareja contraria te pilla una seña, puede cantarla en voz alta."),
            ("Variantes",
             "- **A chico**: partidas a 30 piedras en vez de 40.\n"
             "- **Sin señas**: más limpio y mucho más difícil.\n"
             "- **Mus corrido**: no hace falta que los cuatro acepten el mus para cambiar "
             "cartas.\n"
             "- Cada zona tiene sus propias reglas de cobro: acordadlas antes de empezar."),
        ],
    ),
    dict(
        slug="tute",
        title="Tute",
        tagline="Bazas con triunfo, cantes de veinte y cuarenta, y el tute que gana de golpe.",
        summary="Se reparte toda la baraja y se juega al arrastre: hay que asistir al palo y "
                "matar si puedes. Reunir rey y caballo del mismo palo se canta y da puntos, y "
                "juntar los cuatro reyes o los cuatro caballos gana la partida en el acto.",
        players=(2, 4), best=4, teams=2,
        decks=[dict(slug="espanola-40", quantity=1)],
        missing="strict",
        missing_note="Se reparte la baraja entera y los cantes son parejas concretas: sin el "
                     "caballo de copas, ni se reparte igual ni se puede cantar.",
        duration=(20, 40), complexity=4, age_min=10,
        extras=["papel y lápiz"], mechanics=["bazas", "triunfo", "cantes", "parejas"],
        adult=False,
        sections=[
            ("Objetivo",
             "Sumar más puntos que el rival entre las cartas ganadas en bazas y los cantes. "
             "Hay 120 puntos en cartas más 10 por las diez últimas."),
            ("Preparación",
             "Con cuatro jugadores se reparten diez cartas a cada uno, en parejas "
             "enfrentadas, y se acaba la baraja. La última carta que se reparte quien da se "
             "muestra a todos: su palo es el **triunfo**."),
            ("Valor de las cartas",
             "- As: 11 puntos\n- Tres: 10\n- Rey: 4\n- Caballo: 3\n- Sota: 2\n"
             "- Siete, seis, cinco, cuatro y dos: 0\n\n"
             "El orden de fuerza dentro de un palo es as, tres, rey, caballo, sota, siete, "
             "seis, cinco, cuatro, dos."),
            ("Desarrollo: el arrastre",
             "Se juega al arrastre desde la primera baza: estás obligado a echar una carta "
             "del palo de salida y, si puedes ganar la baza, a ganarla. Si no tienes el palo, "
             "tienes que echar triunfo si te queda alguno. Si ya hay un triunfo en la mesa y "
             "puedes superarlo, debes hacerlo. Quien gana la baza sale en la siguiente."),
            ("Los cantes",
             "Justo después de ganar una baza puedes cantar si tienes en la mano rey y "
             "caballo del mismo palo:\n\n"
             "- **Las veinte**: rey y caballo de un palo que no sea triunfo, 20 puntos.\n"
             "- **Las cuarenta**: rey y caballo del palo de triunfo, 40 puntos.\n\n"
             "Se canta en voz alta y se enseñan las dos cartas, que siguen en juego."),
            ("El tute",
             "Si reúnes los cuatro reyes o los cuatro caballos y lo cantas, ganas la partida "
             "en ese momento, sin contar puntos."),
            ("Puntuación",
             "Al acabar las bazas, cada bando suma el valor de sus cartas más sus cantes, y "
             "las diez últimas valen 10 puntos para quien gane la última baza. Gana quien más "
             "sume. Lo normal es anotar varias manos y jugar a un total acordado."),
            ("Variantes",
             "- **Tute cabrón** (o tute subastado): con baraja de 48 y pujando por elegir "
             "triunfo.\n"
             "- **Con robo**: se reparten menos cartas y se roba del mazo hasta agotarlo; el "
             "arrastre empieza entonces, como en el guiñote.\n"
             "- A tres jugadores se juega cada uno por su cuenta, repartiendo trece cartas y "
             "dejando una fuera."),
        ],
    ),
    dict(
        slug="guinote",
        title="Guiñote",
        tagline="El tute aragonés: primero robas, y cuando se acaba el mazo empieza lo serio.",
        summary="Bazas con triunfo en dos fases. Mientras queda mazo puedes echar lo que "
                "quieras y robas después de cada baza; cuando se agota, hay que asistir y "
                "matar. Con los cantes de veinte y cuarenta se llega a 101 puntos.",
        players=(2, 4), best=4, teams=2,
        decks=[dict(slug="espanola-40", quantity=1)],
        missing="strict",
        missing_note="El cambio del siete, los cantes y las diez últimas dependen de cartas "
                     "concretas: la baraja tiene que estar completa.",
        duration=(20, 45), complexity=3, age_min=10,
        extras=["papel y lápiz"], mechanics=["bazas", "triunfo", "cantes", "parejas"],
        adult=False,
        sections=[
            ("Objetivo",
             "Llegar a 101 puntos entre cartas ganadas y cantes. Se juega en parejas "
             "enfrentadas."),
            ("Preparación",
             "Seis cartas a cada jugador. El resto va al centro boca abajo y se descubre la "
             "carta de arriba, medio asomada: su palo es el **triunfo**."),
            ("Valor de las cartas",
             "As 11, tres 10, rey 4, caballo 3, sota 2; el resto no vale nada. En total 120 "
             "puntos en cartas, más 10 por ganar la última baza (**las diez últimas**)."),
            ("Primera fase: con mazo",
             "Mientras quede mazo no hay obligación de asistir: puedes echar la carta que "
             "quieras. Gana la baza el triunfo más alto o, si no hay triunfos, la carta más "
             "alta del palo de salida. Quien gana roba primero y sale en la siguiente baza."),
            ("Segunda fase: el arrastre",
             "Cuando se agota el mazo cambian las reglas: hay que asistir al palo de salida, "
             "matar si puedes, y echar triunfo si no tienes el palo. Aquí es donde se decide "
             "la mano, y donde hace falta haber contado las cartas."),
            ("Cantes y cambio del siete",
             "Después de ganar una baza puedes cantar **las veinte** (rey y caballo de un "
             "palo cualquiera) o **las cuarenta** (rey y caballo del triunfo). También puedes "
             "cambiar el siete del palo de triunfo por la carta de triunfo descubierta, si "
             "ésta es una figura."),
            ("Puntuación",
             "Se anotan los puntos de cada mano hasta llegar a 101. Hay que **cantar las "
             "101** en voz alta cuando crees que tu pareja las ha alcanzado: si te "
             "equivocas, la partida es para los contrarios. Por eso conviene llevar la cuenta "
             "de verdad y no a ojo."),
            ("Variantes",
             "- **A 201**: dos partidas seguidas.\n"
             "- **Con señas** entre compañeros, como en el mus.\n"
             "- **Renuncio**: si alguien no asiste debiendo hacerlo y se descubre, pierde la "
             "mano."),
        ],
    ),
    dict(
        slug="cuarenta",
        title="Cuarenta",
        tagline="El juego nacional de Ecuador: caer, ligar y contar hasta cuarenta.",
        summary="Se capturan cartas de la mesa emparejando números o sumándolos, y los puntos "
                "van en fichas: tantos de dos y perros de diez. Se juega en parejas y la "
                "chica se gana al llegar a cuarenta.",
        players=(2, 4), best=4, teams=2,
        decks=[dict(slug="francesa-52", quantity=1,
                    cards_removed=["8", "9", "10"],
                    note="sin los ochos, nueves y dieces: quedan 40 cartas")],
        missing="strict",
        missing_note="El recuento final se hace sobre 40 cartas exactas (20 cartas son 6 "
                     "puntos). Si falta una, el conteo no cuadra.",
        duration=(30, 60), complexity=3, age_min=10,
        extras=["fichas para los tantos y los perros"],
        mechanics=["capturar", "aritmética", "parejas", "memoria"], adult=False,
        sections=[
            ("Objetivo",
             "Llegar a 40 puntos y ganar la **chica**. La partida se gana al llevarse dos "
             "chicas, o de golpe si el rival no ha llegado a 10 puntos al acabar la primera "
             "(lo que se llama *zapatería*)."),
            ("Preparación",
             "Se juega con 40 cartas: coge la baraja francesa y quita los ochos, los nueves y "
             "los dieces. Dos o cuatro jugadores, en parejas enfrentadas. Se reparten cinco "
             "cartas a cada uno y se ponen cuatro boca arriba en la mesa.\n\n"
             "Los puntos se llevan con fichas: cada **tanto** vale 2 puntos y cada **perro** "
             "vale 10."),
            ("Capturar cartas",
             "En tu turno echas una carta a la mesa. Puedes llevarte cartas de dos maneras:\n\n"
             "- **Caer**: tu carta es igual a una de la mesa, y te llevas las dos.\n"
             "- **Ligar o sumar**: tu carta es igual a la suma de dos o más cartas de la "
             "mesa, y te llevas todas ésas junto con la tuya.\n\n"
             "Si no capturas nada, la carta se queda en la mesa."),
            ("Puntos durante la mano",
             "- **Caída**: 2 puntos, si caes con una carta igual a la que acaba de echar el "
             "rival.\n"
             "- **Limpia**: 2 puntos, si tu captura deja la mesa vacía.\n"
             "- **Ronda**: 2 puntos, si al repartir te llegan tres cartas del mismo número. "
             "Hay que pedirla antes de jugar tu primera carta."),
            ("Conteo al final de la mano",
             "Se cuentan las cartas que ha capturado cada pareja. Veinte cartas son 6 puntos, "
             "y cada carta de más añade punto, redondeando al par siguiente. Si ninguna "
             "pareja llega a veinte, la que tenga más cartas se lleva 2 puntos."),
            ("Variantes",
             "Las reglas de conteo cambian bastante de una zona a otra: qué pasa si las dos "
             "parejas llegan a veinte cartas, si existe la *doble ronda* como victoria "
             "automática, o cuántos puntos valen las cartas de más. Acordadlo en la mesa "
             "antes de la primera mano y no a mitad de partida."),
        ],
    ),
    dict(
        slug="solitario-klondike",
        title="Solitario (Klondike)",
        tagline="El de siempre: siete columnas, cuatro palos y paciencia.",
        summary="El solitario clásico, para jugar solo. Se ordenan las cartas en columnas "
                "alternando color y en orden descendente, para ir subiendo cada palo del as "
                "al rey. No siempre se puede ganar, y eso es parte del juego.",
        players=(1, 1), best=1, teams=None,
        decks=[dict(slug="francesa-52", quantity=1)],
        missing="strict",
        missing_note="Si falta una carta, el solitario es imposible de terminar: te quedarás "
                     "siempre a un hueco.",
        duration=(5, 20), complexity=2, age_min=7,
        extras=[], mechanics=["solitario", "ordenar"], adult=False,
        sections=[
            ("Objetivo",
             "Subir las 52 cartas a cuatro montones, uno por palo, empezando por el as y "
             "acabando en el rey."),
            ("Preparación",
             "Reparte siete columnas de izquierda a derecha: la primera con una carta, la "
             "segunda con dos, y así hasta siete. Solo la última carta de cada columna va "
             "boca arriba. Las 24 cartas restantes quedan en la mano como **talón**."),
            ("Desarrollo",
             "Sobre una carta boca arriba puedes colocar la inmediatamente inferior de color "
             "contrario: un seis rojo va sobre un siete negro. Puedes mover una carta o un "
             "bloque entero ya ordenado. Al descubrir una carta tapada, se vuelve boca "
             "arriba. En una columna vacía solo puede empezar un rey.\n\n"
             "Cuando no haya movimientos, levanta cartas del talón de una en una y juega la "
             "que quede arriba. Los ases suben a los montones en cuanto aparecen."),
            ("Fin del juego",
             "Ganas si subes las 52 cartas. Pierdes cuando no quedan movimientos posibles ni "
             "cartas útiles en el talón, que pasa más veces de las que gustaría."),
            ("Variantes",
             "- **De tres en tres**: se levantan tres cartas del talón y solo se puede jugar "
             "la de arriba. Mucho más difícil.\n"
             "- **Vueltas limitadas**: solo puedes repasar el talón una o tres veces.\n"
             "- **Sacar del montón**: se permite bajar una carta ya subida para desatascar "
             "una columna."),
        ],
    ),
]
