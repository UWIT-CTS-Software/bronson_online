FROM registry.fedoraproject.org/fedora:latest
EXPOSE 7878

RUN sudo dnf install -y cargo rustc gnupg wget postgresql postgresql-server postgresql-libs gcc openssl-devel libpq-devel git texlive-scheme-basic texlive-latex texlive-pdflscape texlive-pgfplots texlive-pgf texlive-titling texlive-helvetic texlive-pdftex pdflatex --nodocs --setopt=install_weak_deps=False
RUN cargo --version && \
    rustc --version
RUN sudo dnf update -y
RUN sudo dnf clean all -y
RUN git clone -b main https://github.com/UWIT-CTS-Software/bronson_online.git
WORKDIR /bronson_online
RUN git clone https://github.com/UWIT-CTS-Software/CFM_Code.git
RUN cargo build --profile release