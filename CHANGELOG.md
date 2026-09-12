# Changelog

## [1.6.0](https://github.com/SaintKlinn/saint-daily/compare/v1.5.1...v1.6.0) (2026-09-12)


### Nouveautés

* add a configurable lead time for scheduled-task reminders ([385dbd3](https://github.com/SaintKlinn/saint-daily/commit/385dbd339b41696f26b24ba3e701b584a272070e))
* add a desktop agenda widget fed from the main window ([d8cbccc](https://github.com/SaintKlinn/saint-daily/commit/d8cbccc090bf74cff26e7a5dcd21e66e69644197))
* add a distraction-free focus mode for a single engagement ([50a4d62](https://github.com/SaintKlinn/saint-daily/commit/50a4d6292765cb1f1b049b318b655e5e1782003a))
* add a duration selector to task creation, pre-fillable from a URL ([71087d9](https://github.com/SaintKlinn/saint-daily/commit/71087d9f6c408dad9eaf1120d2c9da049eb9db2c))
* add a global shortcut that jumps straight to a new entry ([e136201](https://github.com/SaintKlinn/saint-daily/commit/e1362013218d88cf5bdcb875159797e3a158cd54))
* add a minimal screen to create a one-off task ([f939d18](https://github.com/SaintKlinn/saint-daily/commit/f939d183e1a7f72c68d2e8810b8604a17aaffb10))
* add a paginated hook for the user's full practice history ([19658b4](https://github.com/SaintKlinn/saint-daily/commit/19658b4cfd8ee6aeb38f81cd01641807c9681dad))
* add a priority selector to task creation ([9d4f826](https://github.com/SaintKlinn/saint-daily/commit/9d4f826ef66dec4fc2df62feb969493d3793b266))
* add a project selector to task and skill creation ([b039413](https://github.com/SaintKlinn/saint-daily/commit/b039413feb0f178a4d11dbcf838bab50fc0b3306))
* add a recurrence selector to task creation ([e312edf](https://github.com/SaintKlinn/saint-daily/commit/e312edf85a35d96793581922ffb26451ee631192))
* add a sub-task checklist to the task popover ([27d4393](https://github.com/SaintKlinn/saint-daily/commit/27d439317237fbc9c0252bf3b0fb50bfcd956ddb))
* add best-streak, badge and goal-progress calculations ([abd886b](https://github.com/SaintKlinn/saint-daily/commit/abd886be5fd16d771b828a269e2c0af8bd5c2cd5))
* add findNextFreeSlot scheduling algorithm ([97daf39](https://github.com/SaintKlinn/saint-daily/commit/97daf39482253aab998ef7540dd233ca80dbe902))
* add goal definitions and an optional mood per entry ([a11a69a](https://github.com/SaintKlinn/saint-daily/commit/a11a69ab5af1778f44219bca4e9f72c5ff25b465))
* add project list, creation, and detail screens with navigation ([f1f1029](https://github.com/SaintKlinn/saint-daily/commit/f1f1029ae2fd06668eedf7943903daf195dee3a0))
* add project-grouping fields to the engagement data layer ([35d63fb](https://github.com/SaintKlinn/saint-daily/commit/35d63fbf1dd5cb339036414e35a5999121d79efd))
* add pure recurrence planning logic ([68f50b1](https://github.com/SaintKlinn/saint-daily/commit/68f50b1948211eacd7df88b815b4830516a43600))
* add pure retrospective aggregations for the bilan screen ([ca47be2](https://github.com/SaintKlinn/saint-daily/commit/ca47be2fb8806fbd22ac80487b4607c0aa8cd692))
* add pure scheduling logic for task reminders ([2805a19](https://github.com/SaintKlinn/saint-daily/commit/2805a19788c86e4b5019f443e90d0be6bebf0121))
* add pure week/block-position helpers for the calendar grid ([dae9431](https://github.com/SaintKlinn/saint-daily/commit/dae9431269b0276b73a03935ee31b7cb43ad46b8))
* add quick reschedule (plus tard aujourd'hui / demain) to the task popover ([dad3486](https://github.com/SaintKlinn/saint-daily/commit/dad3486c39c20236e4e1aac2a3cf37389502caa4))
* add recurrence fields to the engagement data layer ([82a6203](https://github.com/SaintKlinn/saint-daily/commit/82a6203a635ffe410486a83f1dd602c59c23a8be))
* add scheduled_ends_at and the practice-history calendar preference ([0b39fc2](https://github.com/SaintKlinn/saint-daily/commit/0b39fc22c99dd14af62cf299e461a824bd39cc51))
* add soft deletion with a restorable trash for engagements ([0025021](https://github.com/SaintKlinn/saint-daily/commit/0025021f2af31a0ee333afc16090df9ef8c88e09))
* add task priority to the data layer ([d1df2af](https://github.com/SaintKlinn/saint-daily/commit/d1df2af3857b5507afa9bc376ffa85da1e3cb3fe))
* add the bilan screen with its route and nav entry ([ae89c77](https://github.com/SaintKlinn/saint-daily/commit/ae89c77e0d1188b3dc506bf384ae7a7efb3bb0e8))
* add the breakdown, week comparison and time-of-day widgets ([191ecd7](https://github.com/SaintKlinn/saint-daily/commit/191ecd724eeb1e67a71a7f3d97630907af95b6fc))
* add the calendar week view with navigation and empty-slot task creation ([d298909](https://github.com/SaintKlinn/saint-daily/commit/d2989097b1239dcc5f645c273269d29bd17bc186))
* add the contribution-graph style practice heatmap ([20f540c](https://github.com/SaintKlinn/saint-daily/commit/20f540c864b591aea62085ef6cf248e9eb600926))
* add the task popover and optional practice-history overlay to the calendar ([6f1a12a](https://github.com/SaintKlinn/saint-daily/commit/6f1a12a91180b55ba8e1df75a26856e4de6e67d3))
* add the trash screen with restore and permanent delete ([5273b40](https://github.com/SaintKlinn/saint-daily/commit/5273b40b6a3be41e1b9a1e4cbc9e637f70fb6446))
* add the unified engagement migration and rename Skill types to Engagement ([d590903](https://github.com/SaintKlinn/saint-daily/commit/d59090315dd71a1510bb2a33b0fd7c64d824e2cc))
* chain a pomodoro onto another engagement between phases ([3b47243](https://github.com/SaintKlinn/saint-daily/commit/3b47243649babccada86e0c45c58db4963fb1ee5))
* edit a task's or skill's project from the popover and detail screen ([f66b655](https://github.com/SaintKlinn/saint-daily/commit/f66b6550b1ca8e562ccc8341c2f1b908bc6168f2))
* edit a task's recurrence rule from the calendar popover ([1fdb62c](https://github.com/SaintKlinn/saint-daily/commit/1fdb62ca9e051bbb48a1c5a2e52c1a37cd384372))
* export the whole history as JSON or CSV ([282124c](https://github.com/SaintKlinn/saint-daily/commit/282124c4bbcdce9bc77c189a18b5c067bb20b74e))
* include mood in the JSON and CSV export ([77b9446](https://github.com/SaintKlinn/saint-daily/commit/77b9446586a65d4f12ab7f6420b740719a5922bb))
* invite the user to their weekly review once a week ([32ac316](https://github.com/SaintKlinn/saint-daily/commit/32ac3160c9894093fa110a8d570ed52856f44281))
* let a skill, project or task be sent to the trash ([258ec27](https://github.com/SaintKlinn/saint-daily/commit/258ec273434ff734aafe24cb40f304b129de817e))
* make task priority editable from the calendar popover, with a visual indicator ([7f679c4](https://github.com/SaintKlinn/saint-daily/commit/7f679c487da6d8ea910bb0e55991b1f089ffe435))
* notify before and at the start of a scheduled task ([08ae499](https://github.com/SaintKlinn/saint-daily/commit/08ae4994c59f05c8e5e9230dea2c5dedaaf130a3))
* offer to resume the most recently practised skill ([aac97dd](https://github.com/SaintKlinn/saint-daily/commit/aac97ddc135ea90d2e444ba276feb71e43f3de05))
* record an optional mood alongside a practice entry ([694feea](https://github.com/SaintKlinn/saint-daily/commit/694feea33e3a3d9a4be6ca5f883cb36df964336d))
* rename useSkills to useEngagements, generalize the milestone and practice-entry hooks ([1f21f3c](https://github.com/SaintKlinn/saint-daily/commit/1f21f3ca6a8e32dbca3416445cb49a9c16921faf))
* show a priority dot on tasks in Tâches à faire ([af49616](https://github.com/SaintKlinn/saint-daily/commit/af4961699d7a71ae1913338f3a920cffe1a0e63e))
* show and complete planned tasks on the Accueil screen ([f9c9fd7](https://github.com/SaintKlinn/saint-daily/commit/f9c9fd7109f6e9be2a8d6eee411703f26017e8c8))
* show goal progress, records and badges on a skill ([8713e94](https://github.com/SaintKlinn/saint-daily/commit/8713e94750228d0696b0553f969851e59bcc6bdc))
* show the next scheduled engagement in the tray tooltip ([df8009b](https://github.com/SaintKlinn/saint-daily/commit/df8009bc05b539cdb4110d904894a0233be91090))
* show the pomodoro overlay automatically while the window is away ([1d8c4fa](https://github.com/SaintKlinn/saint-daily/commit/1d8c4faa34a317a2afaaf2ec10e6ba77c140709b))
* silently top up recurring task series on app load ([2e4ed93](https://github.com/SaintKlinn/saint-daily/commit/2e4ed93473e04dffe8f574b24e405b1617fadda1))
* start a pomodoro on a task straight from the calendar ([a3c45e3](https://github.com/SaintKlinn/saint-daily/commit/a3c45e3657e88cd8ab036abbe5ed61880ade7fda))
* track when the weekly review banner was last dismissed ([15de915](https://github.com/SaintKlinn/saint-daily/commit/15de915d9940cc853e6c73cbe619eb8e4b2874ca))


### Corrections

* add proactive required-indicator to NouveauSkill's Nom field ([39d2a04](https://github.com/SaintKlinn/saint-daily/commit/39d2a042714eb11c6ad344af6bc4b0edb00f4668))
* add required-indicator to NouvelleTache's Titre and Planification fields ([6d31379](https://github.com/SaintKlinn/saint-daily/commit/6d313790c935a8fe05ce8373d45c232c7464d504))
* address final review findings (palette typo, sticky header, surfaced errors) ([570363f](https://github.com/SaintKlinn/saint-daily/commit/570363fe4ad25bc3a31e60fad70abee0c0a0cbf7))
* address final review findings (required a11y, focus ring stacking) ([b74ec55](https://github.com/SaintKlinn/saint-daily/commit/b74ec55c2b148c867e8102e23dafbcccd893c156))
* address final review findings (required planification, task archiving, loading gate, migration transaction, stale comments) ([57f76f2](https://github.com/SaintKlinn/saint-daily/commit/57f76f2b5de88dc0936238c5882ad298a03f8bae))
* batch recurrence writes and guard against overlapping edits ([f802ac3](https://github.com/SaintKlinn/saint-daily/commit/f802ac383ddcc36f8ebfaec6d8eca4699c3d285f))
* clamp the reminder-lead input so 0 or negative can't persist ([4e92cd1](https://github.com/SaintKlinn/saint-daily/commit/4e92cd1a3a2df3a7b1a8ee45c64cb6ca27b2a689))
* clear agenda widget on logout and tighten its data feed ([f7c1daf](https://github.com/SaintKlinn/saint-daily/commit/f7c1daf0eabe80ac5b2df5c3d446d5ec53f633e3))
* clear the overlay's active-session flag on logout ([374f7d5](https://github.com/SaintKlinn/saint-daily/commit/374f7d503133534205488a3c6120574059d08296))
* correct stale skill_app_settings table name in calendar spec ([3122abc](https://github.com/SaintKlinn/saint-daily/commit/3122abc14cc2566d86d01fd8611652de911c3c83))
* disable the stop button while an engagement switch is in flight ([f8c3427](https://github.com/SaintKlinn/saint-daily/commit/f8c3427d8e26389d2771633f35f02cbdbcca9198))
* do not send reminder_lead_minutes on the default-settings INSERT ([a3867d8](https://github.com/SaintKlinn/saint-daily/commit/a3867d8ea60bf178ae18ba5c6acc1cb4c41120eb))
* exclude projects from every existing skill filter ([1359b33](https://github.com/SaintKlinn/saint-daily/commit/1359b3348171dbf4fae82740ad661b56a2f16569))
* floor the displayed goal progress and pin edge-case coverage ([a59b1bf](https://github.com/SaintKlinn/saint-daily/commit/a59b1bf70d49eae204f6208a1f3789cd80de0d1d))
* group bilan engagement breakdown by recurrence identity ([5081567](https://github.com/SaintKlinn/saint-daily/commit/508156707db5e3a67470e0aac962c6e28d9f3319))
* guard against non-positive interval in recurrence functions ([1c4e7e0](https://github.com/SaintKlinn/saint-daily/commit/1c4e7e0f181928bf5f810780712a593469bdb1b5))
* guard recurrence sync effect against re-entrant loading toggles ([5a1de1a](https://github.com/SaintKlinn/saint-daily/commit/5a1de1a849a4bf58d706ce3c86c0a4ba7686b8cf))
* guard the delete button against double-clicks and busy re-entry ([a384191](https://github.com/SaintKlinn/saint-daily/commit/a38419101f375426cb38cb9c035566f46f8408f0))
* keep engagement reminders and tray tooltip alive during focus mode ([d9a8a43](https://github.com/SaintKlinn/saint-daily/commit/d9a8a43f1428033214293aa78c612ab682e8bb60))
* keep the Reprendre button working after ticking a task ([40024da](https://github.com/SaintKlinn/saint-daily/commit/40024da04dbd5e4c0b2c12befdd7283f986ec652))
* make calendar empty-slot cells keyboard-accessible ([a3c6351](https://github.com/SaintKlinn/saint-daily/commit/a3c6351a4a3f1b6ce9dbd8d2154677b4d7b8f002))
* make dismissing the weekly review banner always work ([35b37fc](https://github.com/SaintKlinn/saint-daily/commit/35b37fc0e48e01d774bd35eda90ae4249af4cc31))
* make project purge and soft-delete safe against partial failure ([25daa5c](https://github.com/SaintKlinn/saint-daily/commit/25daa5ced3a7411a6c34927da3a058a36e8fd3ef))
* make reminder hook self-sufficient, fix stale interval math ([f8bdaf8](https://github.com/SaintKlinn/saint-daily/commit/f8bdaf8736dbfbe6cd128a4b481031e49fdae48f))
* preserve projectId on regenerated recurring occurrences ([bda238f](https://github.com/SaintKlinn/saint-daily/commit/bda238f49e8cc657184a2e4ee36bb3a8e2161a60))
* prevent backward snooze and surface popover action errors ([8a9c755](https://github.com/SaintKlinn/saint-daily/commit/8a9c755440cd97c824caa1de48164c07ff7b84c0))
* prevent double-counted practice minutes on engagement switch ([320362a](https://github.com/SaintKlinn/saint-daily/commit/320362ac58645ecdb623a7509d22c891114c3b80))
* raise priority palette to WCAG 3:1 non-text contrast, add aria-label ([8274f87](https://github.com/SaintKlinn/saint-daily/commit/8274f87757cb1c40f680de1691f0daf4db62bf96))
* raise the bilan heatmap ramp above 3:1 contrast ([aa619ce](https://github.com/SaintKlinn/saint-daily/commit/aa619ce9e55df38ba32c364ad21c5a3a04fc1d6b))
* refresh the tasks list when a task is marked done ([ab415f3](https://github.com/SaintKlinn/saint-daily/commit/ab415f3285f357b0d9e70ba7712acb67fed82eb1))
* remaining important and minor findings from final branch review ([6ea1fd5](https://github.com/SaintKlinn/saint-daily/commit/6ea1fd5faf7904986f894b9b411cde74b292fc89))
* repair the focus-mode countdown, exit path and loading flash ([a6fce13](https://github.com/SaintKlinn/saint-daily/commit/a6fce13ecd53a873790f50bf09b2277921485e5a))
* stop notifying for tasks that were sent to the trash ([edf5a6e](https://github.com/SaintKlinn/saint-daily/commit/edf5a6e2837dc62ea33180b05f42bd3a01817294))
* surface export failures and stop overclaiming success ([071ee4d](https://github.com/SaintKlinn/saint-daily/commit/071ee4d7d67273d45852d776802bdd96baed43cc))
* unify formatMinutes, paginate all practice-entry hooks, fix remaining bilan contrast/overflow issues ([4f64546](https://github.com/SaintKlinn/saint-daily/commit/4f64546005f0087258789617dc3beb09f5ab9df4))
* update every screen to consume the renamed engagement hooks ([01ff1ae](https://github.com/SaintKlinn/saint-daily/commit/01ff1aee769dacbfc7ed846a874301e9870d1418))
* use a French-correct CSV delimiter and fix export correctness bugs ([c736e4f](https://github.com/SaintKlinn/saint-daily/commit/c736e4f0e2bb1734ee9096aaa56908e41e515dd0))
* use the shared Toggle component for the calendar practice-history switch ([c218ae1](https://github.com/SaintKlinn/saint-daily/commit/c218ae1c7bf6d9e9616deef57a1580cacfe25775))
* validate goal target, make badge state accessible, show mood ([23783d9](https://github.com/SaintKlinn/saint-daily/commit/23783d956fca4383bef74fc59fe3b6d8c189c14f))


### Documentation

* add design spec for advanced task mechanics (snooze, recurrence, projects) ([7d49048](https://github.com/SaintKlinn/saint-daily/commit/7d49048d3e29447ca5a3ba9da80906043838db19))
* add design spec for task priority (sub-project 3, piece 1/5) ([0874fe5](https://github.com/SaintKlinn/saint-daily/commit/0874fe57c9ae4d981f5a3257f4f0ceda23abdd8d))
* add design spec for the calendar/agenda week view (sub-project 2) ([8e93f06](https://github.com/SaintKlinn/saint-daily/commit/8e93f06b8844179886704de773541a8892c89cb7))
* add design spec for the rest of the Daily Tool backlog ([afb081c](https://github.com/SaintKlinn/saint-daily/commit/afb081c26ff40f94b94c0374a523dfc4220dd35c))
* add design spec for the unified Engagement data model (sub-project 1) ([18edc06](https://github.com/SaintKlinn/saint-daily/commit/18edc063aeea15086d67c51eb05cfa8b2e01b6d9))
* add design spec for UI/UX audit corrections ([033f15d](https://github.com/SaintKlinn/saint-daily/commit/033f15d5b0ac3ee30976b45c16c07c79d311e13d))
* add implementation plan for data export and the weekly review ([1d90d61](https://github.com/SaintKlinn/saint-daily/commit/1d90d61b914860033fb3e9bfda2111a91a9c0d00))
* add implementation plan for pomodoro pinning and focus mode ([132f67d](https://github.com/SaintKlinn/saint-daily/commit/132f67df6d0ed34f5e0c10e2ef3391003d34356f))
* add implementation plan for quick task reschedule ([9b2cbd9](https://github.com/SaintKlinn/saint-daily/commit/9b2cbd970c721549779df56c47127d0c8e8b6595))
* add implementation plan for scheduled reminders ([eb2241c](https://github.com/SaintKlinn/saint-daily/commit/eb2241c7e8d986889af8674afd8d4afcad1c3828))
* add implementation plan for sub-tasks and project grouping ([968a5b8](https://github.com/SaintKlinn/saint-daily/commit/968a5b82a7cd4a49610095186cde750e36d4eab9))
* add implementation plan for task priority ([d6506f0](https://github.com/SaintKlinn/saint-daily/commit/d6506f01980c5282230785636b19b49d9fc932fe))
* add implementation plan for task recurrence ([07b6a45](https://github.com/SaintKlinn/saint-daily/commit/07b6a452d12ba8d2f1f475fd8d7ad8f3ca2fa2fe))
* add implementation plan for the bilan screen ([fc25951](https://github.com/SaintKlinn/saint-daily/commit/fc25951de04cc4444866405a70df50b57beffcbc))
* add implementation plan for the calendar/agenda week view ([41a1cf0](https://github.com/SaintKlinn/saint-daily/commit/41a1cf0ae6bc608c996d6ff573a0bcd763c1af8b))
* add implementation plan for the friction-reduction chantier ([df9ca44](https://github.com/SaintKlinn/saint-daily/commit/df9ca4448d0492ce01c387330995b52342dccd75))
* add implementation plan for the motivation chantier ([009ca08](https://github.com/SaintKlinn/saint-daily/commit/009ca08bdd468fb1d98516d89e7dfed761745afa))
* add implementation plan for the trash ([56fd62d](https://github.com/SaintKlinn/saint-daily/commit/56fd62d89ed05b5fe5f5108928799c395a04c0f4))
* add implementation plan for the unified engagement model ([021e544](https://github.com/SaintKlinn/saint-daily/commit/021e544964ffa6b4219336e2c3a28426bed82935))
* add implementation plan for UI/UX audit corrections ([e072f87](https://github.com/SaintKlinn/saint-daily/commit/e072f878d0bdd7a052b7cbc7bf0cd285cbd9fa0b))
* drop the app-lock chantier from the backlog spec ([14a84e0](https://github.com/SaintKlinn/saint-daily/commit/14a84e087cddd4921063c777862399306791e02a))

## [1.5.1](https://github.com/SaintKlinn/saint-daily/compare/v1.5.0...v1.5.1) (2026-09-05)


### Corrections

* upgrade Electron to 44.2.0 and electron-builder to 26.15.3, CI to Node 22 ([70a4340](https://github.com/SaintKlinn/saint-daily/commit/70a4340b428188aebbf96ef887f543aaa1e14c98))

## [1.5.0](https://github.com/SaintKlinn/saint-daily/compare/v1.4.0...v1.5.0) (2026-09-05)


### Nouveautés

* add filterSkillsForPicker and sortSkillsByRecentPractice helpers ([79df5bc](https://github.com/SaintKlinn/saint-daily/commit/79df5bc1753661dda2ae9e18e31b600653fb2c07))
* fix a Pomodoro session's work duration for its whole lifetime ([cf75302](https://github.com/SaintKlinn/saint-daily/commit/cf753024f920d023a9b5d8eceb0a539b797eaf4f))
* let a Pomodoro session's work duration be chosen at launch ([8d701dd](https://github.com/SaintKlinn/saint-daily/commit/8d701dd1d19c224d1a9daed2401eddb9ab18ac4b))
* replace the Pomodoro skill select with a searchable, streak-aware picker ([046d980](https://github.com/SaintKlinn/saint-daily/commit/046d980d0c9cfdcf808da4fefaca224adefcd17f))


### Corrections

* address whole-branch review findings for Pomodoro skill picker and duration input ([41d3c06](https://github.com/SaintKlinn/saint-daily/commit/41d3c061d5cc10c318daf903556c99a4a3364390))


### Documentation

* add design spec for the Pomodoro launch-screen improvements (Phase A) ([3d5bd20](https://github.com/SaintKlinn/saint-daily/commit/3d5bd205dbbe54069c229dd35f95597144bcb582))
* bring Pomodoro Phase A spec and plan into this worktree ([eefbda3](https://github.com/SaintKlinn/saint-daily/commit/eefbda34627cdf3401a104c1cc77f59e890246de))

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
