# UWIT - Bronson Style Guide
From file name and pathing to indentation to comments, these guidelines intend to unify the developmental contributions to this project regardless of the source.

## Table of Contents:
  - [File Naming and Pathing](#file-naming-and-pathing)
  - [Data Files](#data-files)
    - [CSV files](#csv-files)
    - [JSON files](#json-files)
  - [Package Management Files](#package-management-files)
    - [TOML files](#toml-files)
  - [Front-end Programming](#front-end-programming)
    - [HTML](#html)
    - [CSS](#css)
    - [JavaScript](#javascript)
  - [Back-end Programming](#back-end-programming)
    - [Rust](#rust)
    - [Python](#python)


## File Naming and Pathing
Files will be named so that they are distinct from other files in the program regardless of scope. A file name will describe the function of a resource and will be snake case if necessary. Typically if a file provides a similar resource to an existing one with some notable difference (eg. a file that aggregates partial information from several other files), a short "tag" is appended to the filename prefixed by an underscore to maintain the snake case paradigm. The extension on a file will be indicative of the standard file extension practices for the given content formatting. Even though you can technically make every file a .yippee file, that's a nightmarish thing to do and may your family be forever plagued if you disagree.

A file's path will indicate the role of a resource in the project such that different files with the same path fulfill similar needs in the scope of the program's architecture. For example, all of the resources in the "data" folder provide code with static data to be read in from the file, regardless of which part of the codebase needs it and what format this data is in.

NOTE: file name and path considerations are only relevant when the name or path of a file are not necessary for the compiler of package manager's sanity. main.rs is only in src/bin instead of src/ because it makes cargo happy.


## Data Files
### CSV files
Comma Separated Value typed files should abide by using commas as a delimiter as much as possible. In the event that commas absolutely cannot be used for delimiting, a tag should be added to the file's name to indicate this change. The first line of a CSV file should be the column names. If code packages allow for a struct or dictionary to be established with these, their use is encouraged for readability.

### JSON files

### Markdown Files


## Package Management Files
### TOML files


## Front-end Programming
### HTML/CSS
[Google's HTML/CSS Style Guide](https://google.github.io/styleguide/htmlcssguide.html)

### JavaScript
[Google's JavaScript Style Guide](https://google.github.io/styleguide/htmlcssguide.html)

## Back-end Programming
### Rust

### Python
