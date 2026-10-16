# Sanaz Katpitia, personal portfolio

My personal portfolio site, built around the thing I watch every race weekend: a Formula 1 start.
The page opens on the grid as car 27. Press start, five red lights come on with a beep each, and once they go out to an engine roar, the rest of the site runs like a race weekend:
practice (about me), qualifying (skills) and team radio (contact).

**Live site:** https://san2736.github.io/personal_portfolio/

## Built with

- Plain HTML, CSS and JavaScript, no framework and no build step
- Hosted on GitHub Pages, deployed straight from the `main` branch
- [Titillium Web](https://fonts.google.com/specimen/Titillium+Web), self-hosted in `fonts/` (SIL Open Font License)

## Files

- `index.html`: the page and all its content
- `styles.css`: colours, layout and the start-light animation
- `script.js`: the start sequence and the timing-tower navigation
- `404.html`: the page shown for a broken link
- `sounds/start.mp3`: the start-light beeps and engine sound
- `tools/make_start_sound.py`: the Python script that generates that sound (NumPy and SciPy), so the audio is original rather than a recording
- `fonts/`: the Titillium Web font files

To preview locally, open `index.html` in a browser.

## Credits

- Design, content and code by Sanaz Katpitia, with help from an AI coding assistant (Claude), as allowed by the assignment.
- The racing red and yellow are inspired by Ferrari's colours. No team or Formula 1 logos or trademarks are used.
