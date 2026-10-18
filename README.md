# Sanaz Katpitia, personal portfolio

My personal portfolio site, built around the thing I watch every race weekend: a Formula 1 start.
The page opens on the grid as car 27. Press start, the grid holds revs while five red lights come on, each with a tone, and once they go out and the field launches, the rest of the site runs like a race weekend:
practice (about me), qualifying (skills), the race (projects) and team radio (contact).
The scroll bar is a winding race track: a red car follows the circuit as you scroll, and turns round when you scroll back up.

**Live site:** https://san2736.github.io/personal_portfolio/

## Built with

- Plain HTML, CSS and JavaScript, no framework and no build step
- Hosted on GitHub Pages, deployed straight from the `main` branch
- [Titillium Web](https://fonts.google.com/specimen/Titillium+Web), self-hosted in `fonts/` (SIL Open Font License)

## Files

- `index.html`: the page and all its content
- `styles.css`: colours, layout and the start-light animation
- `script.js`: the start sequence, the timing-tower navigation and the race-track scroll bar
- `404.html`: the page shown for a broken link
- `images/`: photos of my own paintings, resized for the web
- `sounds/start.mp3`: the race-start sound (a grid of engines holding revs, then the launch)
- `tools/make_start_sound.py`: the Python script that generates that sound (NumPy and SciPy), so the audio is original rather than a recording
- `fonts/`: the Titillium Web font files

To preview locally, open `index.html` in a browser.

## Credits

- Design, content and code by Sanaz Katpitia, with help from an AI coding assistant (Claude), as allowed by the assignment.
- The rosso corsa red, black and white are inspired by Ferrari's colours. The site's design uses no team or Formula 1 logos.
- All three paintings are my own. "The water lily pond" and "Sailboats" are my versions of paintings by Claude Monet. "Car 16" is my painting of Charles Leclerc's Ferrari; the sponsor names on it are painted by hand as part of the artwork, and belong to their owners.
- The quote "Ask a child to draw a car, and certainly he will draw it red." is attributed to Enzo Ferrari.
