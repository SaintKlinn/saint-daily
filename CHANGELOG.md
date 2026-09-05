# Changelog

## [1.4.0](https://github.com/SaintKlinn/saint-daily/compare/v1.3.0...v1.4.0) (2026-09-04)


### Nouveautés

* add gold pulse feedback when a milestone is checked or a streak extends ([895127b](https://github.com/SaintKlinn/saint-daily/commit/895127b1a9f3819703e7762e52c51a0d4671ffb6))
* add streakJustExtended helper for the streak reward pulse ([2c485b0](https://github.com/SaintKlinn/saint-daily/commit/2c485b0cd2963e4aac7384a6cbb86ab6932ef191))
* gate auto-update downloads on consent, show real progress, restart silently ([9f04f0d](https://github.com/SaintKlinn/saint-daily/commit/9f04f0d33016b172aa2d6aaa4f08fae0cf6f3db4))
* show a gold pulse and message when a full Pomodoro cycle completes ([dd7f76e](https://github.com/SaintKlinn/saint-daily/commit/dd7f76e9a83a09c35438573fc2dab0759136342c))
* signal when a full Pomodoro cycle round completes ([5a7a858](https://github.com/SaintKlinn/saint-daily/commit/5a7a8586d6619657535a738cab0040f5ead08f21))


### Corrections

* add hover/press transitions to buttons, skill rows, and tag chips ([b072bc9](https://github.com/SaintKlinn/saint-daily/commit/b072bc9527c759487f790497b02ca60d62eb02f0))
* address whole-branch review findings for streak pulse, cycle-complete UI, and hover feedback ([e33336f](https://github.com/SaintKlinn/saint-daily/commit/e33336ff75945f8b7ec4fa86dc56927cbf06b0ac))
* gate streak pulse on entries loaded, reset ref on skill change ([8c6bcdb](https://github.com/SaintKlinn/saint-daily/commit/8c6bcdb282718adc782ffd39ae4d651e5c9dd00b))


### Documentation

* add design spec for making the app feel more alive (Phase 1) ([c306a41](https://github.com/SaintKlinn/saint-daily/commit/c306a415f7a9af83d8310e8f8a3d7f8aafe1a2fc))
* bring liveliness Phase 1 spec and plan into this worktree ([720ec5b](https://github.com/SaintKlinn/saint-daily/commit/720ec5bed5e288560ede1c99369a0f1560057b71))
* reserve feat: for major updates, fix: covers bug fixes and small additions ([15b01f0](https://github.com/SaintKlinn/saint-daily/commit/15b01f0d353ceee72eb9e9d9d4f7eb0c81822f4a))

## [1.3.0](https://github.com/SaintKlinn/saint-daily/compare/v1.2.0...v1.3.0) (2026-09-04)


### Nouveautés

* show app version in window title and Réglages, fix startup flash ([df966fe](https://github.com/SaintKlinn/saint-daily/commit/df966fe1a6052e5290629f8708c9bc757495c7b3))


### Corrections

* stop pomodoro overlay from creating a second Supabase auth client ([70e0924](https://github.com/SaintKlinn/saint-daily/commit/70e092445c0b25763c3ebb6a700d454746d35958))

## [1.2.0](https://github.com/SaintKlinn/saint-daily/compare/v1.1.1...v1.2.0) (2026-09-03)


### Nouveautés

* add migration to move Saint Daily tables into their own schema ([9506516](https://github.com/SaintKlinn/saint-daily/commit/9506516d75aa79ec048b663a922e96b8d3b32bda))
* point the Supabase client at the saint_daily schema ([77f9470](https://github.com/SaintKlinn/saint-daily/commit/77f9470f213c5216766208eeedab39d73be9e207))


### Corrections

* extract shared Button/FormField/EmptyState, close real UI gaps ([d4c922e](https://github.com/SaintKlinn/saint-daily/commit/d4c922e7d3634fbbcf7c574f5fe10e806518d425))
* grant anon/authenticated access to the new saint_daily schema ([9f4dd40](https://github.com/SaintKlinn/saint-daily/commit/9f4dd40bb41922f9aec1eb39b1211cb5106f4599))
* remove the day/time greeting label from Accueil entirely ([687d447](https://github.com/SaintKlinn/saint-daily/commit/687d447b0af551156abd004a59ee4d46247a4c44))
* remove the time from the Accueil greeting, keep the day name ([daa80ed](https://github.com/SaintKlinn/saint-daily/commit/daa80edc63eab9c957b59921e9455c80d443df2d))


### Documentation

* document Exposed schemas setup step, clean up Supabase client typing ([ed02f16](https://github.com/SaintKlinn/saint-daily/commit/ed02f16cab45f5d3dff48c20f55124a69bf44c00))

## [1.1.1](https://github.com/SaintKlinn/saint-daily/compare/v1.1.0...v1.1.1) (2026-09-03)


### Corrections

* generate app/installer icons in CI, add branded installer artwork ([52f35b2](https://github.com/SaintKlinn/saint-daily/commit/52f35b217382063d4b4d4ef17eff2b891f9b7e57))
* packaged app was missing its window icon and Supabase config ([e1009c4](https://github.com/SaintKlinn/saint-daily/commit/e1009c4c97232d908e6a6c0295765f42920d96bd))


### Documentation

* add MIT license ([24adbb8](https://github.com/SaintKlinn/saint-daily/commit/24adbb8166caf277fe044efd3e1307efc1077cc4))
* add README ([c9bd7fb](https://github.com/SaintKlinn/saint-daily/commit/c9bd7fb9fb68fecbe8d48f7146786ac566df770b))

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
