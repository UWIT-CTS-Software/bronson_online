FROM registry.fedoraproject.org/fedora:latest
USER root
EXPOSE 7878

RUN sudo dnf install -y cargo rustc gnupg wget postgresql postgresql-libs gcc openssl-devel libpq-devel git
RUN cargo --version && \
    rustc --version
RUN sudo dnf update -y
RUN git clone -b podman_container https://github.com/UWIT-CTS-Software/bronson_online.git
WORKDIR /bronson_online
RUN git clone https://github.com/UWIT-CTS-Software/CFM_Code.git
RUN cargo build --profile release