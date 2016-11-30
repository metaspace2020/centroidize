# centroidize

Helper web application for SCiLS export to METASPACE.

## Description

METASPACE project asks users to provide processed (centroided) data.

SCiLS Lab software added an option for exporting centroided data in 2016b version, but:
* for fully automated processing it requires a `peaks.sqlite` file (new Bruker format)
* if the old Bruker format is used, centroid locations must be provided by _user_

In order to simplify the latter scenario, we developed this simple web application where users can upload the mean spectrum exported from SCiLS Lab
and obtain a `.csv` file with the list of peaks, which can be imported back into SCiLS Lab.

## Website

All code is in `gh-pages` branch, and the Github-hosted website is located at https://metaspace2020.github.io/centroidize/
Usage should be straightforward as the website guides the user through a series of steps, showing example screenshots of SCiLS Lab software along the way.
