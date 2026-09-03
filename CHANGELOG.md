# Changelog

## [1.1.0](https://github.com/SaintKlinn/saint-daily/compare/v1.0.0...v1.1.0) (2026-09-03)


### Nouveautés

* check for and silently download app updates ([6c73ba5](https://github.com/SaintKlinn/saint-daily/commit/6c73ba51ec9c23b35fdc7d989716feca75459bff))
* expose the auto-update status bridge to the renderer ([bd9d938](https://github.com/SaintKlinn/saint-daily/commit/bd9d938795bc5ae70986130fc98067bfeb5bcc3a))
* show a banner to install a downloaded update ([c2c6fa5](https://github.com/SaintKlinn/saint-daily/commit/c2c6fa58291c443b81e5629b775dd54814320099))


### Corrections

* address final-review findings — release trigger, publish type, private-repo auth, tag format, guard timing ([c33ad42](https://github.com/SaintKlinn/saint-daily/commit/c33ad423a1d7f533da0fb7eac3751626b3e4c313))
* don't mark a skill notified before permission is confirmed granted ([34a2d1c](https://github.com/SaintKlinn/saint-daily/commit/34a2d1c6d88f52a8b1abe44b70d5ad19cda00e36))
* drop private-repo auto-update auth, make the repo public instead ([793f615](https://github.com/SaintKlinn/saint-daily/commit/793f615c14481e7c946b2fa08cbba5c12e7c3a1e))
* handle concurrent first-visit settings-row creation race ([121c28a](https://github.com/SaintKlinn/saint-daily/commit/121c28a1add265d41e869a0750733d84ec4e164c))
* preserve milestone input and surface errors on failed add ([c829f36](https://github.com/SaintKlinn/saint-daily/commit/c829f3684b3a5f44848c80c7c26a942e5f0bc84f))
* redirect away from /login after successful sign-in ([cb7c845](https://github.com/SaintKlinn/saint-daily/commit/cb7c84571b91b7c8f33966a909558fddfa6dc8f5))
* use default import for electron-updater to fix ESM named-export interop crash ([e1ab2ca](https://github.com/SaintKlinn/saint-daily/commit/e1ab2cab738cc74b7a8f0579fc49175286d52c7f))


### Divers

* add release-please configuration ([2dd8b3f](https://github.com/SaintKlinn/saint-daily/commit/2dd8b3f2732e02ecb2ea1567d6ade747ed749c87))
* add release-please workflow ([f83402f](https://github.com/SaintKlinn/saint-daily/commit/f83402f895708a0f05bdb8fed12ad944696bde7f))
* build and publish the Windows installer to GitHub Releases ([f7760e0](https://github.com/SaintKlinn/saint-daily/commit/f7760e0fe34443ecdeac037d55ea965f8a839772))
* bump version to 1.0.0 as the release-pipeline baseline ([736999b](https://github.com/SaintKlinn/saint-daily/commit/736999b7a1118127a839b5c841b4a0dca33d7915))
* record the GitHub repository in package.json ([1003dec](https://github.com/SaintKlinn/saint-daily/commit/1003dec1810c8b2dc4585e9311fe62d63b27d0cd))
* retrigger release-please after enabling Actions PR permissions ([21840c1](https://github.com/SaintKlinn/saint-daily/commit/21840c1ce0dc202e88e260653f6b06df0ea5424c))


### Documentation

* correct the spec's commit-type table (only feat/fix bump version) ([4b69de8](https://github.com/SaintKlinn/saint-daily/commit/4b69de8f70c33cf0f67304e05e3af4757bf536dc))
