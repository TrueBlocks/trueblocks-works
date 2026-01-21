-- Revolution Collection Reordering
-- Collection ID: 50073
-- This script deletes all existing CollectionDetails and recreates them in the new order

BEGIN TRANSACTION;

-- Delete existing entries
DELETE FROM CollectionDetails WHERE collID = 50073;

-- Insert in new order with Parts, cartoons interspersed thematically
-- Position 0-1: Front Matter
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23735, 0);  -- So You Say You Want A Revolution (book title)
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23900, 1);  -- 00 - Introduction

-- Position 2: PART I: The DAO Awakening (2016)
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23925, 2);  -- Part I: The DAO Awakening

-- Essays 01-10
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 3949, 3);   -- 01 - The DAO's First Big Decision
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23604, 4);  -- 02 - Smart Contracts are Immutable
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23606, 5);  -- 03 - What the F is a Finney
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23602, 6);  -- 04 - Downloading the DAO
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23597, 7);  -- 05 - A Clue About the DAO Attacker's Location
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23603, 8);  -- 06 - Knowing the Future and Proving You Know It
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23600, 9);  -- 07 - A Too Often Neglected Aspect of Smart Contract Security
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23599, 10); -- 08 - A Eulogy for The DAO
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23598, 11); -- 09 - A Eulogy for The DAO Part II
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23601, 12); -- 10 - DAO Token Holder's Response in Charts

-- Position 13: PART II: Building QuickBlocks (2017)
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23926, 13); -- Part II: Building QuickBlocks

-- Essays 11-20
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23607, 14); -- 11 - Accounting for the Revolution
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23903, 15); -- CARTOON: Bob Cratchit Experiences Crypto Accounting
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23616, 16); -- 12 - The Real Flippening
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23612, 17); -- 13 - It's Growing It's Growing
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23609, 18); -- 14 - Be Careful Little Brain What You Code
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23611, 19); -- 15 - Is the Ice Age Affecting Block Production
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23610, 20); -- 16 - Ethereum Block Production Continues to Slide
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23615, 21); -- 17 - Short Thoughts on Difficulty Calc
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23614, 22); -- 18 - Reading Byzantium's Tea Leaves
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23608, 23); -- 19 - Announcing QuickBlocks
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23613, 24); -- 20 - Playing with Blocks

-- Position 25: PART III: The Decentralization Manifesto (2018)
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23927, 25); -- Part III: The Decentralization Manifesto

-- Essays 21-28
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23620, 26); -- 21 - Defeating the Ethereum DDos Attacks
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23623, 27); -- 22 - The Trace Data Problem
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23621, 28); -- 23 - How Many ERC20 Tokens Do You Have
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23905, 29); -- CARTOON: Bucket O' Money
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23622, 30); -- 24 - Mantras for Decentralized Open Data
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23619, 31); -- 25 - Building an Ethereum Account Scraper with QuickBlocks
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23618, 32); -- 26 - A Short Take on Decentralization
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23624, 33); -- 27 - Vitalik's 75 Message Tweet Storm
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23617, 34); -- 28 - A Conversation about Blockchain Data
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23904, 35); -- CARTOON: Boston Common as per a Third Party

-- Position 36: PART IV: The Unchained Index (2019)
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23928, 36); -- Part IV: The Unchained Index

-- Essays 29-35
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23631, 37); -- 29 - QuickBlarks
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23627, 38); -- 30 - Counting Shit on Ethereum
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23630, 39); -- 31 - Mother May I
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23906, 40); -- CARTOON: Coordination on a Massive Scale
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23628, 41); -- 32 - Indexing Addresses on the Ethereum Blockchain
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23626, 42); -- 33 - A Time Ordered Index of Time Ordered Immutable Data
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23629, 43); -- 34 - It's Not That Difficult
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23625, 44); -- 35 - A Method to Diffuse the Ethereum Difficulty Bomb

-- Position 45: PART V: The Long Grind (2020-2021)
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23929, 45); -- Part V: The Long Grind

-- Essays 36-50
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23640, 46); -- 36 - Simple Undeniable Facts
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23641, 47); -- 37 - TrueBlocks First Quarter 2020 Update
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23639, 48); -- 38 - Links About CLR Radical Markets GitCoin
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23637, 49); -- 39 - How Accurate is EtherScan
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23633, 50); -- 40 - Building Your Own Ethereum Archive Node
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23634, 51); -- 41 - Ethereum's Issuance minerReward
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23635, 52); -- 42 - Ethereum's Issuance uncleReward
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23638, 53); -- 43 - How Safe are My Private Keys (cartoon already here)
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23636, 54); -- 44 - Every 15 Seconds
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23645, 55); -- 45 - Dynamic Traversers in TrueBlocks
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23647, 56); -- 46 - The Rent is Too Damn High
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23646, 57); -- 47 - The Rent is Too Damn High Part II
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23907, 58); -- CARTOON: Loss Due to Layers
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23642, 59); -- 48 - Adventures in Difficulty Bombing
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23643, 60); -- 49 - Calling Smart Contracts with chifra state call
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23644, 61); -- 50 - Commanding the Line

-- Position 62: PART VI: The Specification (2022-2023)
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23930, 62); -- Part VI: The Specification

-- Essays 51-65
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23652, 63); -- 51 - forEveryChain
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23649, 64); -- 52 - Technical Specification for the Unchained Index
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23650, 65); -- 53 - TrueBlocks Covalent Comparison
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23648, 66); -- 54 - Better Accounting for Blockchains
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23651, 67); -- 55 - TrueBlocks Progress Report 4th Quarter 2022
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23667, 68); -- 56 - Why We're Building TrueBlocks
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23659, 69); -- 57 - Recipe Monthly Token Balances
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23658, 70); -- 58 - Recipe Factories
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23662, 71); -- 59 - Thoughts on 10 Random Optimism Retro PGF Projects
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23664, 72); -- 60 - TrueBlocks Progress Report 1st Quarter 2023
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23660, 73); -- 61 - Recipe Simple Speedup
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23654, 74); -- 62 - Hey ChatBot
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23665, 75); -- 63 - Tweets About TrueBlocks
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23663, 76); -- 64 - TrueBlocks Final Report for EF Grant
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23655, 77); -- 65 - Hey ChatGPT Define chifra

-- Position 78: PART VII: The Prisoner's Dilemma (2023-2024)
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23931, 78); -- Part VII: The Prisoner's Dilemma

-- Essays 66-74
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23661, 79); -- 66 - The Prisoner's Dilemma On Crack
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23908, 80); -- CARTOON: The Prisoners Dilemma on Crack
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23653, 81); -- 67 - ChatGPT Responds to Thomas Rush's Recent Article
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23666, 82); -- 68 - Why We Built TrueBlocks
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23657, 83); -- 69 - Impact Diary for TrueBlocks
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23670, 84); -- 70 - Passkey Smasskey
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23669, 85); -- 71 - Exploring Optimism
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23866, 86); -- CARTOON: The Hindenburg L2
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23668, 87); -- 72 - Ethereum Foundation Grant for TrueBlocks mini dApps
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23672, 88); -- 73 - TrueBlocks Comparison with Alchemy Covalent and Etherscan
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23671, 89); -- 74 - Quarterly Report of Q3 2024 TrueBlocks FY24 1558
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23793, 90); -- CARTOON: Neo Finance Cartoon

-- Position 91: PART VIII: The Island (2025-2026)
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23932, 91); -- Part VIII: The Island

-- Essays 75-90
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23680, 92);  -- 75 - Mist II Revenge of the Nerds
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23682, 93);  -- 76 - Quarterly Report of Q4 2024 TrueBlocks FY24 1558
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23678, 94);  -- 77 - Evaluating GoLang CLI Packages
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23685, 95);  -- 78 - TrueBlocks Browse
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23676, 96);  -- 79 - Common Sense
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23687, 97);  -- 80 - TrueBlocks Services SDK
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23675, 98);  -- 81 - Announcing Deep Index Dive
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23684, 99);  -- 82 - Towards an Architecture For Super Fast Local First Apps
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23677, 100); -- 83 - Dalledresses
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23681, 101); -- 84 - Quarterly Report for August 2025 TrueBlocks FY24 1558
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23686, 102); -- 85 - TrueBlocks MiniDapp Preferences Project Design
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23683, 103); -- 86 - Stop I Will Tell You What To Do
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23673, 104); -- 87 - A Proposal to Solve the Blind Signing Problem
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23679, 105); -- 88 - Final Report for EF Grant FY24 1558 TrueBlocks MiniDapps
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23901, 106); -- 89 - The 10 Most Interesting Innovations of TrueBlocks
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23902, 107); -- 90 - The 10 Stupidest Things about TrueBlocks
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23898, 108); -- CARTOON: Waiting for Decentralization (final image)

-- Appendices: Technical Papers
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23920, 109); -- Appendix A: Faster, Richer, Fully Customizable Data
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23919, 110); -- Appendix B: Decentralized, Off-Chain, per-Block Accounting
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23918, 111); -- Appendix C: Adaptive Enhanced Bloom Filters for Identifying
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23917, 112); -- Appendix C2: Adaptive Enhanced Bloom Filters Analysis (spreadsheet)
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23922, 113); -- Appendix D: 18-Decimal Place Accounting on EVM Blockchains
INSERT INTO CollectionDetails (collID, workID, position) VALUES (50073, 23924, 114); -- Appendix E: Specification for the Unchained Index v2.0.0

COMMIT;
